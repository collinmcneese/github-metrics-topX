# GitHub Metrics TopX

Reference example which scans a GitHub Enterprise Server instance to collect Top X metrics of activity across all organizations and repositories.

This example repository uses **Node.js** to communicate with the GitHub GraphQL API using [Octokit](https://github.com/octokit).

## Requirements

- **Node.js**: Tested with `v16.14.2` of **Node.js** with **npm** version `8.6.0`.  Refer to the [Node.js Docs Site](https://nodejs.org/en/) for installation details.
- **Personal Access Token**: A [Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) is used to authenticate with GitHub for this script.  Token should have the following scopes:
  - read:enterprise
  - read:org
  - read:packages
  - read:user
  - repo
  - user:email

## Usage

### Usage - Local Exec

The orgmetrics app can be run from a system which has the [requirements](#requirements) fulfilled for Node.JS.

- Create a `.env` file using provided [.env.example](.env.example) with the following variables:
  - `GHE_API_TOKEN`: **required** Used by [app.js](./app.js), Personal Authentication Token used for API calls.
  - `GHE_HOSTNAME`: Used by [app.js](./app.js), Optional FQDN for GitHub Enterprise Server instance for API calls.  Defaults to `api.github.com`.  For a GitHub Enterprise Server(GHES) installation this would be `GHES_INSTANCE.FQDN.domain`.
- Install npm dependencies:
  `npm install`
- Execute orgmetrics app:
  `npx node app.js`
- Results will be saved to individual JSON files under `./data/orgmetrics` local path and combined to `./orgmetrics.json`.

### Usage - Workflow Dispatch

This example repository can be triggered with a [Workflow Dispatch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch) event to directly trigger a workflow run with parameters.

#### Components - Workflow Dispatch

- [package.json](./package.json): **Node.js** app definition and source of dependencies.
- [app.js](./app.js): Contains orgmetrics app logic.
- Environment Variables used:
  - `GHE_API_TOKEN`: **required** Used by [app.js](./app.js), Personal Authentication Token used for API calls.
  - `GHE_HOSTNAME`: Used by [app.js](./app.js), Optional FQDN for GitHub Enterprise Server instance for API calls.  Defaults to `api.github.com`.  For a GitHub Enterprise Server(GHES) installation this would be `GHES_INSTANCE.FQDN.domain`.
- `orgmetrics.json` file will be saved as a workflow artifact.

#### Workflow Configuration - Workflow Dispatch

The following shows relevant configuration options which are similar to the [orgmetrics.yml](.github/workflows/orgmetrics.yml) workflow located in this repository.

```yaml
on:
  # Allow for manual execution
  workflow_dispatch:
  # Execute on schedule
  schedule:
    - cron:  '30 17 * * *'

jobs:
  orgmetrics_exec:
    runs-on: ubuntu-latest

    env:
      GHE_API_TOKEN: ${{ secrets.GHE_API_TOKEN }}
      GHE_HOSTNAME: ${{ secrets.GHE_HOSTNAME }}
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js 16.x
        uses: actions/setup-node@v1
        with:
          node-version: 16.x
      - name: npm setup
        run: npm install
      - name: exec orgmetrics
        run: npx node app.js
      - name: Save orgmetrics.json artifact
        uses: actions/upload-artifact@v3
        with:
          name: orgmetrics
          path: orgmetrics.json
      - name: Send orgmetrics to metrics endpoint
        run: |
          echo 'This is a step to show an example where the
          orgmetrics.json can be transmitted to a datastore
          where metrics are collected for long-term reporting.'

```

## Output

Example output of an individual repository:

```json
{
  "nameWithOwner": "my-org/my-repo",
  "pushedAt": "2022-10-09T13:49:38Z",
  "defaultBranchRef": {
    "name": "main",
    "target": {
      "id": "MDY6Q29tbWl0MTcwNTphNmNkYWVmYjA4YjUzMDAzZjYzZTc3NGY5MTA4YWY5ODE5YWZlZmNh",
      "authoredDate": "2022-10-09T13:49:38Z",
      "author": {
        "name": "GHE Admin",
        "date": "2022-10-09T08:49:38-05:00"
      }
    }
  },
  "languages": {
    "nodes": [
      {
        "name": "JavaScript"
      }
    ],
    "edges": [
      {
        "size": 338
      }
    ]
  },
  "issues": {
    "nodes": [
      {
        "number": 2,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:42:55Z",
        "closedAt": null
      },
      {
        "number": 3,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:43:02Z",
        "closedAt": null
      },
      {
        "number": 4,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:45:38Z",
        "closedAt": "2022-10-09T13:45:45Z"
      }
    ]
  },
  "pullRequests": {
    "nodes": [
      {
        "number": 1,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:42:44Z",
        "mergedAt": "2022-10-09T13:48:04Z",
        "closedAt": "2022-10-09T13:48:04Z"
      },
      {
        "number": 5,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:46:00Z",
        "mergedAt": "2022-10-09T13:46:06Z",
        "closedAt": "2022-10-09T13:46:06Z"
      },
      {
        "number": 6,
        "author": {
          "login": "ghe-admin"
        },
        "lastEditedAt": null,
        "createdAt": "2022-10-09T13:47:19Z",
        "mergedAt": "2022-10-09T13:49:38Z",
        "closedAt": "2022-10-09T13:49:38Z"
      }
    ]
  }
}
```
