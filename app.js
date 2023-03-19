const { Octokit } = require('@octokit/core');
const { paginateGraphql } = require('@octokit/plugin-paginate-graphql');
const fs = require('fs');
const GQLPaginate = Octokit.plugin(paginateGraphql);
const dotenv = require('dotenv');
const assert = require('assert');
const async = require('async');

// Read .env file, if present
dotenv.config();

// Check for required environment variables
assert(process.env.GHE_API_TOKEN, 'GITHUB_TOKEN is required');

// Create Authenticated Octokit instance
const octokit = new GQLPaginate({
  auth: process.env.GHE_API_TOKEN,
  baseUrl: (process.env.GHE_HOSTNAME ? `https://${process.env.GHE_HOSTNAME}/api/v3` : 'https://api.github.com'),
});

async function getOrgList() {
  try {
    let res = await octokit.graphql.paginate(
      `query paginate($cursor: String) { organizations(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          login
        }
      }}`,
    );

    return res.organizations.nodes.map((org) => org.login);
  } catch (err) {
    console.log(err);
    return [];
  }
}

async function getOrgMetricsData(owner) {
  try {
    let depth = process.env.GHE_METRICS_DEPTH ? process.env.GHE_METRICS_DEPTH : 10;
    let res = await octokit.graphql.paginate(
      `query paginate($cursor: String) { organization(login: "${owner}") {
        login
        repositories(first: 1, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            nameWithOwner
            pushedAt
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  id
                  authoredDate
                  author {
                    name
                    date
                  }
                }
              }
            }
            languages(first: ${depth}) {
              nodes {
                name
              }
              edges {
                size
              }
            }
            issues(last: ${depth}) {
              nodes {
                number
                author {
                  login
                }
                lastEditedAt
                createdAt
                closedAt
              }
            }
            pullRequests(last: ${depth}) {
              nodes {
                number
                author {
                  login
                }
                lastEditedAt
                createdAt
                mergedAt
                closedAt
              }
            }
          }
        }
      }
      rateLimit {
        remaining
        resetAt
      }}`,
    );

    return res;
  } catch (err) {
    console.log(err);
    return [];
  }
}

async function jsonFileMerge(outfile, sourcepath) {
  try {
    fs.writeFileSync(outfile, '[');
    fs.readdirSync(sourcepath).forEach((file, index, arr) => {
      fs.writeFileSync(outfile, fs.readFileSync(`${sourcepath}/${file}`), { flag: 'a' });
      // Do not add a comma after the last element
      if (arr.length - index > 1) {
        fs.writeFileSync(outfile, ',\n', { flag: 'a' });
      }
    });
    fs.writeFileSync(outfile, ']', { flag: 'a' });
  } catch (err) {
    console.log(`Error merging JSON files: ${err}`);
  }
}

async function getResults(orgs) {
  try {
    // Process each org in parallel, limiting to 10 at a time
    async.eachLimit(orgs, 10, async(org) => {
      if (['github-enterprise', 'actions', 'github'].includes(org)) {
        console.log(`skipping ${org}`);
      } else {
        let orgData = await getOrgMetricsData(org);
        await processResults(orgData);
      }
    }).then(() => {
      console.log('Fetching org metrics complete');
      jsonFileMerge('./data/orgmetrics.json', './data/orgmetrics');
      return true;
    });
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function processResults(res) {
  try {
    await res.organization.repositories.nodes.forEach((repo, repoIndex, repoArray) => {
      console.log(`[${repoArray.length + 1 - (repoArray.length - repoIndex)}/${repoArray.length}]: Processing ${repo.nameWithOwner}`);
      let outputPath = './data/orgmetrics';

      if (!fs.existsSync(outputPath)){
        fs.mkdirSync(outputPath, { recursive: true });
      }

      let orgName = repo.nameWithOwner.split('/')[0];
      let repoName = repo.nameWithOwner.split('/')[1];
      let outFile = `${outputPath}/${orgName}_${repoName}.json`;

      console.log(`Writing ${outFile}`);
      fs.writeFileSync(outFile, JSON.stringify(repo, null, 2));
    });
  } catch (err) {
    console.log(`Error processing results: ${err}`);
    return false;
  }
}

async function main() {
  // Use org list from environment variable, if present
  let orgs = process.env.GHE_ORG_LIST ? process.env.GHE_ORG_LIST.split(',').map((org) => org.trim()) : await getOrgList();

  await getResults(orgs);
}

main();
