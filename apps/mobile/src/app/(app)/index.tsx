import { Redirect } from 'expo-router';

/** Signed-in landing: the dashboard, like the web's brand link. */
export default function Index() {
  return <Redirect href="/dashboard" />;
}
