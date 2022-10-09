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

function jsonFileMerge(outfile, sourcepath) {
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

try {
  getOrgList().then((orgs) => {
    async.eachSeries(orgs, async(org, next, err) => {
      console.log(`Processing ${org}`);
      try {
        if (['github-enterprise', 'actions', 'github'].includes(org)) {
          console.log(`skipping ${org}`);
        } else {
          // Process each org individually to reduce concurrent API calls
          // await getOrgMetricsData(org).then((res) => {
          getOrgMetricsData(org).then((res) => {
            res.organization.repositories.nodes.forEach((repo) => {
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
          }).then(() => {
            jsonFileMerge('./orgmetrics.json', './data/orgmetrics');
          });
        }
      } catch (err) {
        console.log(`Error processing ${org}: ${err}`);
      }
    });
  });
} catch (e) {
  console.log(`Error fetching org list: ${e}`);
}
