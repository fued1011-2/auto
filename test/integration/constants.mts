import { nodeConfig } from '../../src/config/node.js';
import { paths } from '../../src/config/paths.js';

const { host, port } = nodeConfig;

export const baseURL = `https://${host}:${port}`;
export const restURL = `${baseURL}/rest`;
export const graphqlURL = `${baseURL}/graphql`;

export const tokenPath = `${paths.auth}/${paths.token}`;

export const POST = 'POST';
export const PUT = 'PUT';
export const DELETE = 'DELETE';

export const ACCEPT = 'Accept';
export const CONTENT_TYPE = 'Content-Type';
export const LOCATION = 'location';
export const IF_NONE_MATCH = 'If-None-Match';
export const IF_MATCH = 'If-Match';
export const AUTHORIZATION = 'Authorization';

export const APPLICATION_JSON = 'application/json';
export const X_WWW_FORM_URL_ENCODED = 'application/x-www-form-urlencoded';
export const GRAPHQL_RESPONSE_JSON = 'application/graphql-response+json';
export const BEARER = 'Bearer';
