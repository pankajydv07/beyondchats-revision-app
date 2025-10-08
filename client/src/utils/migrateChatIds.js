// Migration utility to fix old chat IDs in localStorage
// Run this in browser console to fix existing chats

function migrateChatIDs() {
  try {
    const data = localStorage.getItem('beyondchats_data');
    if (!data) {
      console.log('No stored data found');
      return;
    }
    
    const storedData = JSON.parse(data);
    
    // Function to generate UUID v4
    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    // Fix chat IDs
    if (storedData.chats && Array.isArray(storedData.chats)) {
      storedData.chats.forEach(chat => {
        // Check if chat ID is in old format (chat_timestamp)
        if (chat.id && chat.id.startsWith('chat_') && /^chat_\d+$/.test(chat.id)) {
          console.log('Migrating chat ID:', chat.id);
          chat.id = generateUUID();
          console.log('New chat ID:', chat.id);
        }
      });
      
      // Save back to localStorage
      localStorage.setItem('beyondchats_data', JSON.stringify(storedData));
      console.log('Chat IDs migrated successfully!');
      console.log('Please refresh the page to see the changes.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateChatIDs();