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
  const res = await octokit.graphql.paginate(
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
}

async function getOrgMetricsData(owner) {
  const res = await octokit.graphql.paginate(
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
          languages(first: 10) {
            nodes {
              name
            }
            edges {
              size
            }
          }
          issues(last: 10) {
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
          pullRequests(last: 10) {
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
}

async function jsonFileMerge(outfile, sourcepath) {
  fs.writeFileSync(outfile, '[');
  fs.readdirSync(sourcepath).forEach((file, index, arr) => {
    fs.writeFileSync(outfile, fs.readFileSync(`${sourcepath}/${file}`), { flag: 'a' });
    // Do not add a comma after the last element
    if (arr.length - index > 1) {
      fs.writeFileSync(outfile, ',\n', { flag: 'a' });
    }
  });
  fs.writeFileSync(outfile, ']', { flag: 'a' });
}

async function getResults() {
  const orgs = await getOrgList();
  async.eachLimit(orgs, 100, async(org) => {
    if (['github-enterprise', 'actions', 'github'].includes(org)) {
      console.log(`skipping ${org}`);
    } else {
      const orgData = await getOrgMetricsData(org);
      await processResults(orgData);
    }
  }).then(() => {
    jsonFileMerge('./data/orgmetrics.json', './data/orgmetrics');
  });
}

async function processResults(res) {
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
}

async function main() {
  await getResults();
}

main();
