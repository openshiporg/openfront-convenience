import { keystoneContext } from '../../features/keystone/context'
import { createYoga, maskError } from "graphql-yoga";
import { GraphQLError } from "graphql";

// Production masks unexpected errors as "Unexpected error.". A refusal from our own lifecycle and permission code
// is a plain `Error` ("Refund quantity exceeds remaining quantity for line 1"), so it passes through and the cashier
// sees why. Library errors (Prisma, TypeError, network) are subclasses or carry driver text, so they stay masked.
const DRIVER_TEXT = /prisma|invocation|postgres|ECONN|ETIMEDOUT|socket|undefined|null\b.*\bread|stack|SELECT |INSERT |UPDATE /i;
function isGuardMessage(error: Error) {
  return error.constructor === Error && error.message.length > 0 && error.message.length <= 300 && !DRIVER_TEXT.test(error.message);
}

function maskConvenienceError(error: unknown, message: string, isDev?: boolean) {
  const original = error instanceof GraphQLError ? error.originalError : error;
  if (error instanceof GraphQLError && original instanceof Error && isGuardMessage(original)) {
    // Tagged so the dashboard knows the text was written for staff and shows it instead of a generic failure.
    return new GraphQLError(original.message, { nodes: error.nodes, source: error.source, positions: error.positions, path: error.path, extensions: { code: "OPERATION_REFUSED" } });
  }
  return maskError(error, message, isDev);
}
import processRequest from "graphql-upload/processRequest.js";
import { type NextApiRequest, type NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const contentType = req.headers["content-type"];
  if (contentType?.startsWith("multipart/form-data")) {
    req.body = await processRequest(req, res);
  }

  return createYoga({
    renderGraphiQL: () => {
      return `
        <!DOCTYPE html>
        <html lang="en">
          <body style="margin: 0; overflow-x: hidden; overflow-y: hidden">
          <div id="sandbox" style="height:100vh; width:100vw;"></div>
          <script src="https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"></script>
          <script>
          new window.EmbeddedSandbox({
            target: "#sandbox",
            // Pass through your server href if you are embedding on an endpoint.
            // Otherwise, you can pass whatever endpoint you want Sandbox to start up with here.
            initialEndpoint: window.location.href,
            hideCookieToggle: false,
            initialState: {
              includeCookies: true
            }
          });
          // advanced options: https://www.apollographql.com/docs/studio/explorer/sandbox#embedding-sandbox
          </script>
          </body>
        </html>`;
    },
    graphqlEndpoint: "/api/graphql",
    schema: keystoneContext.graphql.schema,
    context: ({ req, res }: { req: NextApiRequest; res: NextApiResponse }) => {
      return keystoneContext.withRequest(req, res);
    },
    multipart: false,
    maskedErrors: { maskError: maskConvenienceError },
  })(req, res);
}