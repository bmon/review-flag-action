const github = require('@actions/github');
const core = require('@actions/core');
const parsediff = require('parse-diff');

async function run() {
  // This should be a token with access to your repository scoped in as a secret.
  // The YML workflow will need to set myToken with the GitHub Secret Token
  // myToken: ${{ secrets.GITHUB_TOKEN }}
  // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
  const myToken = core.getInput('myToken');

  const client = new github.GitHub(myToken);

  const pr_ref = {
    owner: 'octokit',
    repo: 'rest.js',
    pull_number: 123,
  };

  const {data: commits} = await clients.pulls.listCommits(pr_ref);

  const {data: diff} = await client.pulls.get({
    ...pr_ref,
    mediaType: {
      format: 'diff'
    }
  });

  const files = parsediff(diff);
  files.forEach(file => {
    // if file is binary - don't attempt to parse
    if (file.chunks.length < 1) return;

    // store the first chunk of the file for positioning review comments
    const first_chunk = file.chunks[0];

    file.chunks.forEach(chunk => {
      // comment_start stores the first line of a review comment and tells us if we are recording lines for comment
      var comment_start = undefined;

      chunk.changes.filter(c => c.type === 'add').forEach(c => {
        const line = c.content.substr(1).trim()
        // if this line should start a review comment
        if (!comment_start && line.match("//\S*REVIEW")) {
          comment_start = c;
          // otherwise if we are currently looking for the end of a review comment
        } else if (comment_start && !line.startsWith('//')) {
          //flag_review_comment(first_chunk.ln, comment_start.ln, c.ln);
          comment_start = undefined;
          client.pulls.createComment({
            ...pr_ref,
            headers: {
              accept: "application/vnd.github.comfort-fade-preview+json"
            },
            body: "The author of this pull request requested extra discussion.",
            commit_id: commits[commits.length - 1].sha,
            path: file.to,
            side: 'RIGHT',
            start_side: 'RIGHT',
            start_line: comment_start.ln - first_chunk.ln,
            line: c.ln - first_chunk.ln,
          });
        }
      });
      // if we finished a chunk while reading review comment lines, find the line of the last insertion and finish the comment
      if (comment_start) {
        last_insertion = chunk.changes.filter(c => c.type === 'add').pop()
        //flag_review_comment(first_chunk.ln, comment_start.ln, last_insertion.ln);
        client.pulls.createComment({
          ...pr_ref,
          headers: {
            accept: "application/vnd.github.comfort-fade-preview+json"
          },
          body: "The author of this pull request requested extra discussion.",
          commit_id: commits[commits.length - 1].sha,
          path: file.to,
          side: 'RIGHT',
          start_side: 'RIGHT',
          start_line: comment_start.ln - first_chunk.ln,
          line: last_insertion.ln - first_chunk.ln,
        });
      }
    });

  })
}

run();
