import { View } from 'react-native';

import { ChannelTree } from '@/components/channels/channel-tree';
import { PageEnter } from '@/components/page';
import { TabHeader } from '@/components/shell/screen-header';
import { NODE_LABELS } from '@/lib/labels';

/** Channels tab root: every category and its channels. */
export default function ChannelsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <TabHeader title={NODE_LABELS.listPlural} />
      <PageEnter>
        <ChannelTree />
      </PageEnter>
    </View>
  );
}
