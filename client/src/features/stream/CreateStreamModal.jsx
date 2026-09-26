import { useState } from "react";
import { Radio } from "lucide-react";
import axios from "axios";
import { Alert, Button, Input, Modal, Textarea } from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

const CreateStreamModal = ({ isOpen, onClose, onStreamCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!title.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      // Backend accepts { title, description } — it also notifies the host's
      // followers (STREAM_START) as part of creating the stream.
      const response = await axios.post(`${backendUrl}/api/stream/create`, {
        title: title.trim(),
        description: description.trim(),
      });

      if (response.status === 201) {
        const newStream = response.data;
        toast.success("You're live");
        onStreamCreated?.(newStream);
        setTitle("");
        setDescription("");
        onClose?.();
      }
    } catch (err) {
      console.error("Error creating stream:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to create stream. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose?.();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Go live"
      description="Start a broadcast. Your followers get a notification as soon as you're live."
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-stream-form"
            variant="solid"
            icon={Radio}
            loading={loading}
            disabled={!title.trim()}
          >
            Go live
          </Button>
        </>
      }
    >
      <form id="create-stream-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Stream title *"
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ranked grind — road to Diamond"
          maxLength={TITLE_MAX}
          hint={`${title.length}/${TITLE_MAX}`}
          disabled={loading}
          autoFocus
          required
        />

        <Textarea
          label="Description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="What are you playing? Anything viewers should know?"
          maxLength={DESCRIPTION_MAX}
          hint={`${description.length}/${DESCRIPTION_MAX} characters · Ctrl+Enter to go live`}
          disabled={loading}
        />

        {error && (
          <Alert variant="destructive" className="animate-shake">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
};

export default CreateStreamModal;
