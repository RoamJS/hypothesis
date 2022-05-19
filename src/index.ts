import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import axios from "axios";
import urlRegex from "url-regex-safe";

const ID = "hypothesis";
const CONFIG = toConfigPageName(ID);
runExtension(ID, async () => {
  const { pageUid } = await createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              title: "token",
              type: "text",
              description:
                "Input your Hypothesis User API Token here, which could be obtained from https://hypothes.is/account/developer",
            },
            {
              title: "highlights",
              type: "text",
              description: "The output format to a block from a highlight",
              defaultValue: "HIGHLIGHT [->](URL)",
            },
            {
              title: "notes",
              type: "text",
              description: "The output format to a block from a note",
              defaultValue: "NOTE",
            },
          ],
        },
      ],
    },
  });

  /*
  const sbButton =
    "{{=:|#hypothesis}}" +
    "{{📰:42SmartBlock:Hypothes.is - Open site:42RemoveButton=false}}" +
    "{{📑:42SmartBlock:Hypothes.is - Insert my annotations from site in current block:42RemoveButton=false}}";
  */

  const apiUrl = "https://api.hypothes.is/api";
  const getOpts = () => {
    const tree = getBasicTreeByParentUid(pageUid);
    const userToken = getSettingValueFromTree({ tree, key: "token" });
    return {
      headers: { Authorization: `Bearer ${userToken}` },
    };
  };
  const getUser = () =>
    axios
      .get(`${apiUrl}/profile`, getOpts())
      .then((r) => r.data.userid as string);

  const searchAnnotations = (searchUrl: string) =>
    axios
      .get(`${apiUrl}/${searchUrl}`, {
        headers: {
          Authorization: `Bearer ${getSettingValueFromTree({
            tree: getBasicTreeByParentUid(pageUid),
            key: "token",
          })}`,
        },
      })
      .then((r) => apiAnnotationSimplify(r.data));

  const formatHighlightBasedOnTemplate = (
    template: string,
    highlight: string,
    url: string
  ) => {
    return template
      .replace("HIGHLIGHT", highlight.trim())
      .replace("URL", url)
      .trim();
  };

  const formatNoteBasedOnTemplate = (
    template: string,
    note: string,
    url: string
  ) => {
    return template.replace("NOTE", note.trim()).replace("URL", url).trim();
  };

  const insertAnnotions = async (searchUrl: string) => {
    const results = await searchAnnotations(searchUrl);
    const tree = getBasicTreeByParentUid(pageUid);
    const hTemplate = getSettingValueFromTree({
      tree,
      key: "highlights",
      defaultValue: "HIGHLIGHT [->](URL)",
    });
    const nTemplate = getSettingValueFromTree({
      tree,
      key: "notes",
      defaultValue: "NOTE",
    });
    return results.map((e, i) => {
      var output = "";
      if (e.highlight != "")
        output += formatHighlightBasedOnTemplate(
          hTemplate,
          e.highlight,
          e.context
        );
      output = output.trim();
      if (e.tags.length > 0)
        output += e.tags.map((e) => ` #[[${e}]]`).reduce((e, a) => e + a);
      if (i == results.length - 1) output += "  "; //last block, need spaces

      return {
        text: output,
        children: e.text
          ? [{ text: formatNoteBasedOnTemplate(nTemplate, e.text, e.context) }]
          : [],
      };
    });
  };

  registerSmartBlocksCommand({
    text: "HYPOTHESISINSERTANNOTATIONS",
    handler:
      (context: { targetUid: string }) =>
      (limitArg = "20") => {
        const limit = Number(limitArg) || 20;
        const text = getTextByBlockUid(context.targetUid);
        const articleUrl = text.match(urlRegex({ strict: true }))?.[0];
        return getUser().then((userId) => {
          const searchUrl = `search?limit=${limit}&user=${userId}&order=asc&uri=${encodeURIComponent(
            articleUrl
          )}`;
          return insertAnnotions(searchUrl).then((children) => [
            { text: "", children },
          ]);
        });
      },
  });

  registerSmartBlocksCommand({
    text: "HYPOTHESISPUBLICANNOTATIONS",
    handler:
      (context: { targetUid: string }) =>
      (limitArg = "20") => {
        const limit = Number(limitArg) || 20;
        const text = getTextByBlockUid(context.targetUid);
        const articleUrl = text.match(urlRegex({ strict: true }))?.[0];
        const searchUrl = `search?limit=${limit}&order=asc&uri=${encodeURIComponent(
          articleUrl
        )}`;
        return searchAnnotations(searchUrl).then((annotations) => {
          var users = [...new Set(annotations.map((e) => e.user))];
          return [
            {
              text: `[${annotations[0].title}](https://via.hypothes.is/${annotations[0].uri})`,
              children: users.map((user) => {
                const f = annotations.filter((e) => e.user == user);
                const id = f[0].user
                  .replace("acct:", "")
                  .replace("@hypothes.is", "");
                return {
                  text: `[${id}](https://hypothes.is/users/${id})`,
                };
              }),
            },
          ];
        });
      },
  });

  const apiAnnotationSimplify = async (results: {
    rows: {
      document: { title: string[] };
      uri: string;
      links: { incontext: string };
      text: string;
      tags: string[];
      user: string;
      group: string;
      created: number;
      updated: number;
      target: { selector: { type: string; exact: string }[] }[];
    }[];
  }) => {
    return results.rows.map((e) => {
      var r = {
        title: e.document.title[0],
        uri: e.uri,
        context: e.links.incontext,
        text: e.text,
        highlight: "",
        tags: e.tags,
        user: e.user,
        group: e.group,
        created: e.created,
        updated: e.updated,
      };
      try {
        if (e.target[0].selector) {
          var txt = e.target[0].selector.filter(
            (e) => e.type == "TextQuoteSelector"
          );
          if (txt) r.highlight = txt[0].exact;
        }
      } catch (e) {}
      return r;
    });
  };

  const getAnnotationsSinceDateWithTags = async (
    fromDate: string,
    tags: string
  ) => {
    return getUser().then((userId) => {
      const searchUrl = `search?tags=${encodeURIComponent(
        tags
      )}&user=${userId}&sort=updated&order=asc&search_after=${fromDate}`;
      return searchAnnotations(searchUrl);
    });
  };

  const getAnnotationsSinceDate = async (fromDate: string) =>
    getUser().then((userId) => {
      const searchUrl = `search?user=${userId}&sort=updated&order=asc&search_after=${fromDate}`;
      return searchAnnotations(searchUrl);
    });

  const openArticleInHypothesis = async (blockUid: string) => {
    const text = getTextByBlockUid(blockUid);
    const articleUrl = text.match(urlRegex({ strict: true }))?.[0];
    window.open("https://via.hypothes.is/" + articleUrl, "_blank");
  };

  registerSmartBlocksCommand({
    text: "HYPOTHESISOPENSITE",
    handler: (context: { targetUid: string }) => () => {
      openArticleInHypothesis(context.targetUid);
      return "";
    },
  });
});
