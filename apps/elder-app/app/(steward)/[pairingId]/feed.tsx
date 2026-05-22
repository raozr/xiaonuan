import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Mic, Send, Plus, Trash2, Heart } from 'lucide-react-native';
import { Card } from '../../../src/components/ui/Card';
import { colors, typography } from '../../../src/utils/theme';

interface FeedItem {
  id: string;
  date: string;
  time: string;
  category: string;
  title: string;
  content: string;
  acknowledged: boolean;
}

const mockFeeds: FeedItem[] = [
  {
    id: '1',
    date: 'TODAY',
    time: '10:30 AM',
    category: 'Health',
    title: 'Morning Walk Completed',
    content: 'Mom went for her usual walk around the neighborhood. Heart rate remained stable and she reported feeling good.',
    acknowledged: false,
  },
  {
    id: '2',
    date: 'TODAY',
    time: '8:00 AM',
    category: 'Health',
    title: 'Medication Taken',
    content: 'Morning supplements and blood pressure medication logged successfully via voice confirmation.',
    acknowledged: true,
  },
  {
    id: '3',
    date: 'YESTERDAY',
    time: '10:45 PM',
    category: 'Health',
    title: 'Sleep Pattern',
    content: 'Went to bed slightly earlier than usual. Sensor data indicates deep, uninterrupted sleep through the night.',
    acknowledged: false,
  },
];

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <View className="flex-row gap-stack-md mb-stack-md">
      {/* Timeline line */}
      <View className="items-center">
        <View className="w-10 h-10 rounded-full bg-primaryContainer items-center justify-center mb-1">
          <Heart size={18} color={colors.primary} />
        </View>
        <View className="w-0.5 flex-1 bg-surfaceContainerHighest" />
      </View>

      {/* Card */}
      <Card className="flex-1 p-stack-md">
        <View className="flex-row items-center justify-between mb-stack-sm">
          <View className="flex-row items-center gap-stack-sm">
            <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
              {item.date}, {item.time}
            </Text>
            <View className="bg-surfaceContainerHigh rounded-full px-2 py-0.5">
              <Text className="text-on-surface-variant font-bold" style={typography.labelCaps}>
                {item.category}
              </Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Trash2 size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <Text className="text-on-surface font-semibold mb-1" style={typography.bodyMd}>
          {item.title}
        </Text>
        <Text className="text-on-surface-variant mb-stack-md" style={typography.bodyMd}>
          {item.content}
        </Text>

        {!item.acknowledged && (
          <TouchableOpacity
            className="flex-row items-center gap-stack-sm bg-primaryFixed rounded-full px-stack-md py-stack-sm self-start"
            activeOpacity={0.7}
          >
            <Heart size={14} color={colors.primary} />
            <Text className="text-primary font-semibold" style={typography.labelCaps}>
              Acknowledge
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </View>
  );
}

export default function FeedTab() {
  const [message, setMessage] = useState('');

  return (
    <View className="flex-1 bg-surface-bright">
      <ScrollView className="flex-1 px-margin-mobile" contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}>
        <Text className="text-on-surface mb-stack-md font-semibold" style={typography.bodyLgElderly}>
          Activity Feed
        </Text>
        {mockFeeds.map((item) => <FeedCard key={item.id} item={item} />)}
      </ScrollView>

      {/* Floating Input Bar */}
      <View className="absolute bottom-16 left-margin-mobile right-margin-mobile">
        <View className="flex-row items-center bg-surfaceLowest rounded-full px-stack-md h-steward-target-min shadow-lg"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <TouchableOpacity className="mr-stack-sm" activeOpacity={0.7}>
            <Plus size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TextInput
            className="flex-1 text-on-surface"
            style={typography.bodyMd}
            placeholder="Tell Xiao Nuan something..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity className="ml-2 mr-1" activeOpacity={0.7}>
            <Mic size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
            activeOpacity={0.7}
          >
            <Send size={16} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
