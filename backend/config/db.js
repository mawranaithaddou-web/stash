const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // family: 4 forces IPv4, which is often required for 
      // stable connections in cloud environments like Firebase/Google Cloud
      family: 4 
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    
    // In a production environment, you might want to keep the process 
    // alive for health checks, but for local dev/debugging, 
    // exiting helps identify issues immediately.
    // process.exit(1); 
  }
};

module.exports = connectDB;