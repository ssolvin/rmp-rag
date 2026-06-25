'use client'
import { Box, Stack, TextField, Button } from "@mui/material";
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate My Professor support assistant. How can I help you today?"
    }
  ]);
  const [message, setMessage] = useState('');

  const sendMessage = async () => {
    if (!message.trim()) return; 

    setMessage('');
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content: message },
      { role: "assistant", content: '' }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([...messages, { role: "user", content: message }]),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const processText = async ({ done, value }) => {
        if (done) return;

        const text = decoder.decode(value || new Uint8Array(), { stream: true });

        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const otherMessages = prevMessages.slice(0, prevMessages.length - 1);
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ];
        });

        return reader.read().then(processText);
      };

      await reader.read().then(processText);

    } catch (error) {
      console.error("Failed to fetch stream:", error);
    }
  };

  return (
    <Box sx={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      <Stack direction='column' width='500px' height="700px" border="1px solid black" p={2} spacing={3}>
        
        {/* Chat History Window */}
        <Stack direction='column' spacing={2} sx={{ flexGrow: 1, overflow: 'auto', maxHeight: "100%" }}>
          {messages.map((msg, index) => (
            <Box key={index} sx={{ display: "flex", justifyContent: msg.role === "assistant" ? "flex-start" : "flex-end" }}>
              <Box 
                sx={{
                  bgcolor: msg.role === "assistant" ? "primary.main" : "secondary.main",
                  color: "white",
                  borderRadius: 4, 
                  p: 2,
                  maxWidth: "75%"
                }}
              >
                {msg.content}
              </Box>
            </Box>
          ))}
        </Stack>

        {/* Input Controls */}
        <Stack direction='row' spacing={2}> 
          <TextField 
            label="Message" 
            fullWidth 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
          />
          <Button variant="contained" onClick={sendMessage}>
            Send
          </Button>
        </Stack>

      </Stack>
    </Box>
  )
}