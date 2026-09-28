import ChatHeader from "./ChatHeader";
import MessagesList from "./MessagesList";
import MessageInput from "./MessageInput";
import ChatLockedNotice from "./ChatLockedNotice";

const ChatArea = ({
  currentConversation,
  messages,
  messageInput,
  user,
  isUserTyping,
  messagesEndRef,
  setActiveView,
  onBack,
  getOtherUser,
  formatTime,
  handleInputChange,
  handleKeyPress,
  handleTypingStop,
  sendMessage,
  isConnected = true,
  loadingMessages = false,
  sending = false,
  canMessage = true,
  attachment = null,
  onAttach,
  onRemoveAttachment,
  uploadProgress = null,
  uploadBusy = false,
}) => {
  const otherUser = getOtherUser(currentConversation);
  const otherName = otherUser?.profile?.name || otherUser?.username;

  return (
    <>
      <ChatHeader
        currentConversation={currentConversation}
        setActiveView={setActiveView}
        onBack={onBack}
        getOtherUser={getOtherUser}
        isTyping={isUserTyping}
        isConnected={isConnected}
      />

      <MessagesList
        conversationId={currentConversation._id}
        messages={messages}
        user={user}
        otherUser={otherUser}
        isUserTyping={isUserTyping}
        loading={loadingMessages}
        messagesEndRef={messagesEndRef}
        formatTime={formatTime}
      />

      {canMessage ? (
        <MessageInput
          conversationId={currentConversation._id}
          messageInput={messageInput}
          handleInputChange={handleInputChange}
          handleKeyPress={handleKeyPress}
          handleTypingStop={handleTypingStop}
          sendMessage={sendMessage}
          isConnected={isConnected}
          sending={sending}
          attachment={attachment}
          onAttach={onAttach}
          onRemoveAttachment={onRemoveAttachment}
          uploadProgress={uploadProgress}
          uploadBusy={uploadBusy}
          placeholder={otherName ? `Message ${otherUser?.username ? `@${otherUser.username}` : otherName}` : "Type a message"}
        />
      ) : (
        <ChatLockedNotice user={user} otherUser={otherUser} />
      )}
    </>
  );
};

export default ChatArea;
