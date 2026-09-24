import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { FloatingTabBar } from '@/components/shell/tab-bar/floating-tab-bar';
import { TabBarProvider } from '@/components/shell/tab-bar/tab-bar-context';
import { ChannelUnreadProvider } from '@/hooks/use-channel-unread';

/**
 * Whenever the tabs mount without a specific tab to open (e.g. just after signing in), start on Home.
 * Without this the router falls back to its own route sorting, which put Search first.
 */
export const unstable_settings = { initialRouteName: 'dashboard' };

/**
 * The tabs. Every tab route is declared in a hidden `TabList`; the visible bar is our own `FloatingTabBar`
 * (headless `expo-router/ui` tabs), which lets it expand, collapse on scroll and turn into a search field.
 */
export default function TabsLayout() {
  return (
    <TabBarProvider>
      <ChannelUnreadProvider>
        <Tabs options={{ backBehavior: 'history' }} style={styles.fill}>
          <TabSlot style={styles.fill} />
          <TabList style={styles.hidden}>
            <TabTrigger name="dashboard" href="/dashboard" />
            <TabTrigger name="my-tasks" href="/my-tasks" />
            <TabTrigger name="channels" href="/channels" />
            <TabTrigger name="calendar" href="/calendar" />
            <TabTrigger name="roadmap" href="/roadmap" />
            <TabTrigger name="search" href="/search" />
          </TabList>
          <FloatingTabBar />
        </Tabs>
      </ChannelUnreadProvider>
    </TabBarProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
