import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const GRAPHQL_ENDPOINT = `${API_BASE_URL.replace(/\/+$/, '')}/graphql`;

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: GRAPHQL_ENDPOINT,
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'network-only',
    },
  },
});

export default apolloClient;
