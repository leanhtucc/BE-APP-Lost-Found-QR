# Stream Chat Integration Guide

## 🎯 Tổng quan

Backend đã được tích hợp với **Stream Chat** - một dịch vụ chat real-time chuyên nghiệp. Thay vì tự xây dựng hệ thống chat, chúng ta sử dụng Stream Chat để có:

✅ Real-time messaging (WebSocket)
✅ Typing indicators
✅ Read receipts
✅ File/Image uploads
✅ Reactions, threads, replies
✅ **Auto-Moderation (AI-powered)**
✅ **Spam protection**
✅ **Activity Feeds & Notifications**
✅ **User moderation (mute, ban)**

---

## 📋 Setup Backend

### Bước 1: Đăng ký Stream Chat

1. Truy cập: <https://getstream.io>
2. Đăng ký tài khoản (tìm **Maker Account** để dùng free)
3. Tạo App mới trên Dashboard
4. Copy **API Key** và **API Secret**

### Bước 2: Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# Stream Chat
STREAM_API_KEY=your_stream_api_key_here
STREAM_API_SECRET=your_stream_api_secret_here
```

### Bước 3: Restart Server

```bash
npm run dev
```

---

## 🔌 API Endpoints

Backend cung cấp 4 endpoints để tích hợp Stream Chat:

### 1️⃣ Lấy Stream Token

**Endpoint:** `GET /api/stream/token`

**Authentication:** Required (Bearer Token)

**Mục đích:** Lấy Stream Chat token để authenticate user trên Stream Chat client

**Response:**

```json
{
  "success": true,
  "message": "Stream token generated successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "apiKey": "your_stream_api_key",
    "userId": "user_id_123"
  }
}
```

**Frontend Usage:**

```javascript
// 1. Lấy token từ backend
const response = await fetch("/api/stream/token", {
  headers: {
    Authorization: `Bearer ${yourAccessToken}`,
  },
});

const { token, apiKey, userId } = response.data;

// 2. Connect vào Stream Chat
import { StreamChat } from "stream-chat";
const client = StreamChat.getInstance(apiKey);

await client.connectUser(
  {
    id: userId,
    name: "User Name",
    image: "https://...",
  },
  token
);
```

---

### 2️⃣ Tạo Channel

**Endpoint:** `POST /api/stream/channels/:itemId/:finderId`

**Authentication:** Required

**URL Params:**

- `itemId` - ID của món đồ
- `finderId` - ID của người nhặt đồ

**Response:**

```json
{
  "success": true,
  "message": "Channel created successfully",
  "data": {
    "channel": {
      "channelId": "item_clx123abc_user_finder_id",
      "channelType": "messaging"
    },
    "itemName": "Ví da đen"
  }
}
```

**Frontend Usage:**

```javascript
// Tạo channel khi người nhặt nhấn "Nhắn tin"
const response = await fetch(
  `/api/stream/channels/${item.id}/${currentUser.id}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

const { channel } = response.data;

// Sau đó watch channel này để nhận tin nhắn
const streamChannel = client.channel(channel.channelType, channel.channelId);
await streamChannel.watch();
```

---

### 3️⃣ Lấy danh sách Channel (Inbox)

**Endpoint:** `GET /api/stream/channels`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "message": "Channels retrieved successfully",
  "data": {
    "channels": [
      {
        "id": "item_clx123_finder1",
        "name": "Lost Item: Ví da đen",
        "lastMessage": {
          "text": "Mình nhặt được ví của bạn",
          "created_at": "2026-01-15T10:00:00Z"
        },
        "members": {...},
        "unreadCount": 2
      }
    ],
    "total": 3
  }
}
```

---

### 4️⃣ Đóng Channel

**Endpoint:** `PUT /api/stream/channels/:channelId/close`

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "message": "Channel closed successfully",
  "data": {}
}
```

---

## 📱 Frontend Integration (React Native)

### Bước 1: Install Dependencies

```bash
npm install stream-chat stream-chat-react-native expo-file-system expo-image-picker
```

### Bước 2: Setup Stream Chat Client

Tạo file `src/services/streamChat.js`:

```javascript
import { StreamChat } from "stream-chat";
import AsyncStorage from "@react-native-async-storage/async-storage";

let client = null;

export const initializeStreamChat = async (accessToken) => {
  try {
    // Lấy Stream token từ backend
    const response = await fetch("http://localhost:3000/api/stream/token", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const { token, apiKey, userId } = await response.json();

    // Khởi tạo Stream Chat client
    client = StreamChat.getInstance(apiKey);

    // Connect user
    await client.connectUser(
      {
        id: userId,
        name: "User Name", // Lấy từ user profile
        image: "https://...",
      },
      token
    );

    return client;
  } catch (error) {
    console.error("Failed to initialize Stream Chat:", error);
    throw error;
  }
};

export const getStreamClient = () => {
  if (!client) {
    throw new Error("Stream Chat not initialized");
  }
  return client;
};

export const disconnectStreamChat = async () => {
  if (client) {
    await client.disconnectUser();
    client = null;
  }
};
```

### Bước 3: Wrap App với Stream Chat Provider

Trong `App.js`:

```javascript
import { Chat, OverlayProvider } from "stream-chat-react-native";
import { initializeStreamChat, getStreamClient } from "./services/streamChat";

function App() {
  const [client, setClient] = useState(null);

  useEffect(() => {
    const init = async () => {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (accessToken) {
        const streamClient = await initializeStreamChat(accessToken);
        setClient(streamClient);
      }
    };

    init();

    return () => {
      if (client) {
        client.disconnectUser();
      }
    };
  }, []);

  if (!client) {
    return <LoadingScreen />;
  }

  return (
    <OverlayProvider>
      <Chat client={client}>
        <NavigationContainer>{/* Your app screens */}</NavigationContainer>
      </Chat>
    </OverlayProvider>
  );
}
```

### Bước 4: Tạo Channel khi quét QR

Trong màn hình QR scan:

```javascript
const handleStartChat = async () => {
  try {
    // Tạo channel trên backend (dùng URL params)
    const response = await fetch(
      `http://localhost:3000/api/stream/channels/${item.id}/${currentUser.id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const { channel } = await response.json();

    // Navigate to chat screen
    navigation.navigate("ChatScreen", {
      channelId: channel.channelId,
      channelType: channel.channelType,
    });
  } catch (error) {
    console.error("Failed to create channel:", error);
  }
};
```

### Bước 5: Hiển thị Chat Screen

Tạo `ChatScreen.js`:

```javascript
import { Channel, MessageList, MessageInput } from "stream-chat-react-native";
import { getStreamClient } from "../services/streamChat";

const ChatScreen = ({ route }) => {
  const { channelId, channelType } = route.params;
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    const initChannel = async () => {
      const client = getStreamClient();
      const ch = client.channel(channelType, channelId);
      await ch.watch();
      setChannel(ch);
    };

    initChannel();
  }, [channelId, channelType]);

  if (!channel) {
    return <LoadingScreen />;
  }

  return (
    <Channel channel={channel}>
      <MessageList />
      <MessageInput />
    </Channel>
  );
};
```

### Bước 6: Hiển thị Inbox (Channel List)

Tạo `InboxScreen.js`:

```javascript
import { ChannelList } from "stream-chat-react-native";
import { getStreamClient } from "../services/streamChat";

const InboxScreen = ({ navigation }) => {
  const client = getStreamClient();

  const filters = {
    type: "messaging",
    members: { $in: [client.userID] },
  };

  const sort = { last_message_at: -1 };

  return (
    <ChannelList
      client={client}
      filters={filters}
      sort={sort}
      onSelect={(channel) => {
        navigation.navigate("ChatScreen", {
          channelId: channel.id,
          channelType: channel.type,
        });
      }}
    />
  );
};
```

---

## 🎨 Customization

Stream Chat cung cấp rất nhiều components để customize:

### Custom Message Bubble

```javascript
import { MessageSimple } from "stream-chat-react-native";

const CustomMessage = (props) => {
  return (
    <MessageSimple
      {...props}
      // Custom styles
      messageContentStyle={{
        backgroundColor: "#007AFF",
        borderRadius: 20,
      }}
    />
  );
};

// Sử dụng
<Channel channel={channel} Message={CustomMessage}>
  <MessageList />
  <MessageInput />
</Channel>;
```

### Custom Input

```javascript
const CustomInput = () => {
  return (
    <MessageInput
      additionalTextInputProps={{
        placeholder: "Nhập tin nhắn...",
      }}
      // Thêm button gửi ảnh, vị trí, etc.
    />
  );
};
```

---

## ✨ Tính năng nâng cao

### 1. Gửi hình ảnh

```javascript
import * as ImagePicker from "expo-image-picker";

const handleSendImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });

  if (!result.canceled) {
    // Stream Chat tự động upload ảnh
    await channel.sendMessage({
      text: "Đây là ảnh món đồ",
      attachments: [
        {
          type: "image",
          asset_url: result.assets[0].uri,
        },
      ],
    });
  }
};
```

### 2. Gửi vị trí GPS

```javascript
import * as Location from "expo-location";

const handleSendLocation = async () => {
  const { coords } = await Location.getCurrentPositionAsync({});

  await channel.sendMessage({
    text: "Tôi đang ở đây",
    attachments: [
      {
        type: "location",
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    ],
  });
};
```

### 3. Typing Indicators

```javascript
// Tự động có sẵn, không cần code gì thêm!
// Khi user đang gõ, Stream Chat sẽ tự động hiển thị:
// "John đang soạn tin..."
```

### 4. Read Receipts

```javascript
// Tự động có sẵn!
// Tin nhắn đã đọc sẽ hiện dấu tích xanh
```

---

## 🔒 Security

### Development Mode

Trong development, bạn có thể tắt auth check trên Stream Dashboard:

- Settings → Security → Disable Auth Checks

### Production Mode

Trong production, KHÔNG BAO GIỜ tắt auth check. Luôn dùng token từ backend.

---

## �️ Moderation & Safety Features

### 1. Auto-Moderation (AI)

Khi tạo channel, auto-moderation đã được bật:

```javascript
// Backend tự động enable
automod: "AI",
automod_behavior: "flag" // Flag messages thay vì xóa
```

**Tự động phát hiện:**

- Spam messages
- Toxic language
- Inappropriate content
- Profanity

### 2. Flag Messages

**Flag một message không phù hợp:**

```bash
POST /api/stream/messages/:messageId/flag
Authorization: Bearer {token}
```

**Unflag message:**

```bash
DELETE /api/stream/messages/:messageId/flag
Authorization: Bearer {token}
```

**Xem messages bị flag:**

```bash
GET /api/stream/channels/:channelId/flagged-messages
Authorization: Bearer {token}
```

**Frontend:**

```javascript
// Flag message
await channel.flagMessage(messageId);

// Unflag message
await channel.unflagMessage(messageId);
```

### 3. Mute Users

**Mute user (không cho gửi tin nhắn):**

```bash
POST /api/stream/channels/:channelId/mute/:targetUserId
Authorization: Bearer {token}
Content-Type: application/json

{
  "timeout": 60  // phút (optional, không có = vĩnh viễn)
}
```

**Unmute user:**

```bash
DELETE /api/stream/channels/:channelId/mute/:targetUserId
Authorization: Bearer {token}
```

**Frontend:**

```javascript
// Mute user for 60 minutes
await channel.muteUser(targetUserId, 60);

// Unmute user
await channel.unmuteUser(targetUserId);
```

### 4. Ban Users

**Ban user khỏi channel:**

```bash
POST /api/stream/channels/:channelId/ban/:targetUserId
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Spam",
  "timeout": 1440  // phút (optional, không có = vĩnh viễn)
}
```

**Unban user:**

```bash
DELETE /api/stream/channels/:channelId/ban/:targetUserId
Authorization: Bearer {token}
```

**Frontend:**

```javascript
// Ban user for 24 hours (1440 minutes)
await channel.banUser(targetUserId, {
  reason: "Spam",
  timeout: 1440,
});

// Unban user
await channel.unbanUser(targetUserId);
```

---

## 🔔 Notifications & Activity Feeds

### 1. Get Notifications

**Lấy danh sách thông báo:**

```bash
GET /api/stream/notifications
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "channelId": "item_xxx",
        "channelName": "Lost Item: Ví da đen",
        "unreadCount": 3,
        "lastMessage": {
          "text": "Xin chào!",
          "user": { "name": "Finder" }
        },
        "timestamp": "2026-01-17T10:30:00Z"
      }
    ],
    "total": 1,
    "unreadTotal": 3
  }
}
```

### 2. Mark All Read

**Đánh dấu tất cả đã đọc:**

```bash
POST /api/stream/notifications/mark-read
Authorization: Bearer {token}
```

**Frontend:**

```javascript
// Mark all channels as read
const response = await fetch("/api/stream/notifications/mark-read", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### 3. Real-time Notifications

**Setup notification listeners:**

```javascript
import { useEffect } from "react";
import { getStreamClient } from "./services/streamChat";

const NotificationListener = () => {
  useEffect(() => {
    const client = getStreamClient();

    // Lắng nghe tin nhắn mới
    const handleNewMessage = (event) => {
      if (event.user.id !== client.userID) {
        // Show notification
        showNotification({
          title: event.user.name,
          body: event.message.text,
          channelId: event.channel_id,
        });
      }
    };

    // Lắng nghe channel mới
    const handleNewChannel = (event) => {
      showNotification({
        title: "New Chat",
        body: `${event.user.name} started a conversation`,
        channelId: event.channel.id,
      });
    };

    // Register listeners
    client.on("message.new", handleNewMessage);
    client.on("notification.added_to_channel", handleNewChannel);

    return () => {
      client.off("message.new", handleNewMessage);
      client.off("notification.added_to_channel", handleNewChannel);
    };
  }, []);

  return null;
};
```

### 4. Log Activity

**Track user activity:**

```bash
POST /api/stream/activity
Authorization: Bearer {token}
Content-Type: application/json

{
  "activityType": "new_message",
  "metadata": {
    "channelId": "item_xxx",
    "messageId": "msg_123"
  }
}
```

**Activity types:**

- `new_message` - Tin nhắn mới
- `new_channel` - Channel mới
- `item_found` - Tìm thấy đồ
- `item_returned` - Đã trả đồ

---

## 📊 So sánh với Custom Chat

| Tính năng         | Custom Chat (Prisma)            | Stream Chat            |
| ----------------- | ------------------------------- | ---------------------- |
| Real-time         | ❌ (cần polling hoặc Socket.io) | ✅ WebSocket built-in  |
| Typing indicators | ❌ Phải tự code                 | ✅ Sẵn có              |
| Read receipts     | ❌ Phải tự code                 | ✅ Sẵn có              |
| File upload       | ❌ Phải tự code                 | ✅ Tự động             |
| Auto-Moderation   | ❌ Phải tự code                 | ✅ AI-powered          |
| Spam protection   | ❌ Phải tự code                 | ✅ Built-in            |
| Notifications     | ❌ Phải tự code                 | ✅ Real-time           |
| UI Components     | ❌ Phải tự design               | ✅ Sẵn có              |
| Scalability       | ⚠️ Phải tự scale                | ✅ Auto scale          |
| Maintenance       | ⚠️ Phải tự maintain             | ✅ Stream lo           |
| Cost              | 💰 Server costs                 | 💰 Free tier available |

---

## 🎓 Kết luận

Stream Chat giúp bạn:

- ✅ Tiết kiệm thời gian phát triển
- ✅ Có chat real-time chuyên nghiệp
- ✅ **Chống spam & toxic tự động (AI)**
- ✅ **Notifications real-time**
- ✅ **Moderation tools sẵn có**
- ✅ Tập trung vào business logic
- ✅ Dễ scale khi app lớn

**Khuyến nghị:** Sử dụng Stream Chat cho production app. Chỉ dùng custom chat nếu có yêu cầu đặc biệt về data privacy hoặc muốn học cách build chat system từ đầu.

---

## 📚 Tài liệu tham khảo

- Stream Chat Documentation: <https://getstream.io/chat/docs/>
- React Native SDK: <https://getstream.io/chat/docs/sdk/react-native/>
- API Reference: <https://getstream.io/chat/docs/rest/>
- Moderation: <https://getstream.io/chat/docs/moderation/>
- Activity Feeds: <https://getstream.io/activity-feeds/docs/>

---

**Happy coding! 🚀**
