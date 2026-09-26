import { MessagesSquare, SquarePen } from "lucide-react";
import { Button, EmptyState } from "../../../components/ui";

const WelcomeScreen = ({ onNewChat }) => {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-grid p-6">
      <EmptyState
        icon={MessagesSquare}
        title="Select a conversation"
        description="Pick a thread from the list, or search a player by @username to start a new one. Messages arrive in real time."
        action={
          onNewChat && (
            <Button icon={SquarePen} onClick={onNewChat}>
              New message
            </Button>
          )
        }
      />
    </div>
  );
};

export default WelcomeScreen;
