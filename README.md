# Hypothesis

Integrate your Hypothesis account with Roam!

## Usage

This extension includes Roam `Command Palette` & [SmartBlock](https://github.com/RoamJS/smartblocks) commands designed to pull in annotations from [Hypothes.is](https://hypothes.is). To get started,

### API Token

1. Register for a free user account at [Hypothes.is](https://hypothes.is)
2. Copy your free developer key from Hypothes.is which can be obtained at: [https://hypothes.is/account/developer](https://hypothes.is/account/developer)
3. Add the Hypothesis User Token API in your Roam Depot Settings

### Highlights Format

The output format for the block for a highlight can be customized in Roam Depot Settings.

The template will replace `HIGHLIGHT` for where the highlight text should appear and `URL` for where the URL to the hypothesis annotation.

### Notes Format

The output format for the block for a note can be customized in Roam Depot Settings.

The template will replace `NOTE` for where the note text should appear and `URL` for where the `URL` to the hypothesis annotation.

## Commands

The following commands will then be available to you.

### Import Public Hypothesis Annotations

Looks at the text in the current block for a URL to an article. For that URL retrieves annotations from all users and inserts them as child blocks, with a limit of 20.

The Smartblock Command equivalent is `<%HYPOTHESISPUBLICANNOTATIONS%>`, which takes in an optional limit parameter.

### Import Private Hypothesis Annotations

Looks at the text in the current block for a URL to an article. For that URL retrieves "my" annotations and inserts them as child blocks, with a limit of 20.

The Smartblock Command equivalent is `<%HYPOTHESISINSERTANNOTATIONS%>`, which takes in an optional limit parameter.

### Open Site in Hypothesis

Looks at the text in the current block for a URL. It opens the URL in Hypothes.is for annotation.

The Smartblock Command equivalent is `<%HYPOTHESISOPENSITE%>`.
