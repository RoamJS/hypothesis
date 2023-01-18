import runExtension from "roamjs-components/util/runExtension";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import apiGet from "roamjs-components/util/apiGet";
import createBlock from "roamjs-components/writes/createBlock";
import renderToast from "roamjs-components/components/Toast";
import getChildrenLengthByParentUid from "roamjs-components/queries/getChildrenLengthByParentUid";

// https://github.com/spamscanner/url-regex-safe/blob/master/src/index.js
const protocol = `(?:https?://)`;
const host = "(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)";
const domain = "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*";
const tld = `(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))`;
const port = "(?::\\d{2,5})?";
const path = "(?:[/?#][^\\s\"\\)']*)?";
const urlRegex = `(?:${protocol}|www\\.)(?:${host}${domain}${tld})${port}${path}`;

export default runExtension({
  run: async (args) => {
    args.extensionAPI.settings.panel.create({
      tabTitle: "Hypothesis",
      settings: [
        {
          id: "token",
          action: { type: "input", placeholder: "xxx" },
          description:
            "Input your Hypothesis User API Token here, which could be obtained from https://hypothes.is/account/developer",
          name: "API Token",
        },
        {
          id: "highlights",
          action: { type: "input", placeholder: "HIGHLIGHT [->](URL)" },
          description: "The output format to a block from a highlight",
          name: "Highlights Format",
        },
        {
          id: "notes",
          action: { type: "input", placeholder: "NOTE" },
          description: "The output format to a block from a note",
          name: "Notes Format",
        },
      ],
    });

    const domain = "https://api.hypothes.is/api";
    const getAuth = () => {
      const userToken = args.extensionAPI.settings.get("token") as string;
      return `Bearer ${userToken}`;
    };
    const getUser = () =>
      apiGet<{ userid: string }>({
        domain,
        path: `profile`,
        authorization: getAuth(),
      }).then((r) => r.userid);

    const searchAnnotations = (searchUrl: string) =>
      apiGet<Parameters<typeof apiAnnotationSimplify>[0]>({
        domain,
        path: searchUrl,
        authorization: getAuth(),
      }).then((r) => apiAnnotationSimplify(r));

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

    const fetchAnnotationsAsRoamBlocks = async (searchUrl: string) => {
      const results = await searchAnnotations(searchUrl);
      const hTemplate =
        (args.extensionAPI.settings.get("highlights") as string) ||
        "HIGHLIGHT [->](URL)";
      const nTemplate =
        (args.extensionAPI.settings.get("notes") as string) || "NOTE";
      return results.map((e, i) => {
        var output = "";
        if (e.highlight != "")
          output += formatHighlightBasedOnTemplate(
            hTemplate,
            e.highlight.replace(/(\n){3,}/g, '\n'),
            e.context
          );
        output = output.trim();
        if (e.tags.length > 0)
          output += e.tags.map((e) => ` #[[${e}]]`).reduce((e, a) => e + a);
        if (i == results.length - 1) output += "  "; //last block, need spaces

        return {
          text: output,
          children: e.text
            ? [
                {
                  text: formatNoteBasedOnTemplate(nTemplate, e.text, e.context),
                },
              ]
            : [],
        };
      });
    };

    const unregisterPrivateAnnotations = registerSmartBlocksCommand({
      text: "HYPOTHESISINSERTANNOTATIONS",
      handler:
        (context: { targetUid: string }) =>
        (limitArg = "20") => {
          const limit = Number(limitArg) || 20;
          const text = getTextByBlockUid(context.targetUid);
          const articleUrl = text.match(urlRegex)?.[0];
          return getUser().then((userId) => {
            const searchUrl = `search?limit=${limit}&user=${userId}&order=asc&uri=${encodeURIComponent(
              articleUrl
            )}`;
            return fetchAnnotationsAsRoamBlocks(searchUrl).then((children) => [
              { text: "", children },
            ]);
          });
        },
    });

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Import Private Hypothesis Annotations",
      callback: () => {
        const blockUid =
          window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        if (!blockUid)
          renderToast({
            content:
              "Must fire this command while focused on a block with a URL",
            intent: "warning",
            id: "roamjs-public-hypothesis",
          });
        const limit = 20; //Number(limitArg) || 20;
        const text = getTextByBlockUid(blockUid);
        const articleUrl = text.match(urlRegex)?.[0];
        return getUser().then((userId) => {
          const searchUrl = `search?limit=${limit}&user=${userId}&order=asc&uri=${encodeURIComponent(
            articleUrl
          )}`;
          const base = getChildrenLengthByParentUid(blockUid);
          return fetchAnnotationsAsRoamBlocks(searchUrl).then((children) =>
            Promise.all(
              children.map((node, i) =>
                createBlock({ node, parentUid: blockUid, order: base + i })
              )
            )
          );
        });
      },
    });

    const unregisterAnnotations = registerSmartBlocksCommand({
      text: "HYPOTHESISPUBLICANNOTATIONS",
      handler:
        (context: { targetUid: string }) =>
        (limitArg = "20") => {
          const limit = Number(limitArg) || 20;
          const text = getTextByBlockUid(context.targetUid);
          const articleUrl = text.match(urlRegex)?.[0];
          const searchUrl = `search?limit=${limit}&order=asc&uri=${encodeURIComponent(
            articleUrl
          )}`;
          return fetchAnnotationsAsRoamBlocks(searchUrl).then((children) => [
            { text: "", children },
          ]);
        },
    });

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Import Public Hypothesis Annotations",
      callback: () => {
        const blockUid =
          window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        if (!blockUid)
          renderToast({
            content:
              "Must fire this command while focused on a block with a URL",
            intent: "warning",
            id: "roamjs-public-hypothesis",
          });
        const limit = 20; // Number(limitArg) || 20;
        const text = getTextByBlockUid(blockUid);
        const articleUrl = text.match(urlRegex)?.[0];
        const searchUrl = `search?limit=${limit}&order=asc&uri=${encodeURIComponent(
          articleUrl
        )}`;
        const base = getChildrenLengthByParentUid(blockUid);
        return fetchAnnotationsAsRoamBlocks(searchUrl).then((children) =>
          Promise.all(
            children.map((node, i) =>
              createBlock({ node, parentUid: blockUid, order: base + i })
            )
          )
        );
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
      const articleUrl = text.match(urlRegex)?.[0];
      window.open("https://via.hypothes.is/" + articleUrl, "_blank");
    };

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Open Site in Hypothesis",
      callback: () => {
        openArticleInHypothesis(
          window.roamAlphaAPI.ui.getFocusedBlock()["block-uid"]
        );
      },
    });

    const unregesterOpenSite = registerSmartBlocksCommand({
      text: "HYPOTHESISOPENSITE",
      handler: (context: { targetUid: string }) => () => {
        openArticleInHypothesis(context.targetUid);
        return "";
      },
    });
    return () => {
      unregesterOpenSite();
      window.roamAlphaAPI.ui.commandPalette.removeCommand({
        label: "Open Site in Hypothesis",
      });
      unregisterAnnotations();
      window.roamAlphaAPI.ui.commandPalette.removeCommand({
        label: "Import Public Hypothesis Annotations",
      });
      unregisterPrivateAnnotations();
      window.roamAlphaAPI.ui.commandPalette.removeCommand({
        label: "Import Private Hypothesis Annotations",
      });
    };
  },
});
