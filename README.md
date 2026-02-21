# GAME PORTAL - Livestream Social Platform

A comprehensive full-stack social media and e-commerce platform designed for gaming communities. This platform combines social networking, real-time communication, live streaming, and e-commerce functionality with a modern gaming-inspired dark theme.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend Overview](#backend-overview)
- [Frontend Overview](#frontend-overview)
- [Database Models](#database-models)
- [Real-time Features](#real-time-features)
- [Payment Integration](#payment-integration)
- [Setup & Installation](#setup--installation)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🎮 Core Social Features

- **User Authentication**: Complete signup/login system with JWT tokens and email verification
- **User Profiles**: Customizable profiles with bio, profile/cover images, followers/following system
- **Posts & Feed**: Create, like, comment, and delete posts with image/video upload support
- **Real-time Chat**: Direct messaging with typing indicators and message status
- **Notifications**: Real-time notifications for likes, comments, follows, messages, and store activities

### 🛒 E-commerce Platform

- **Store Management**: Users can create and manage their own stores
- **Product Management**: Add, edit, delete products with multiple images and inventory tracking
- **Shopping Cart**: Add to cart, update quantities, manage multiple store items
- **Wishlist**: Save favorite products for later
- **Order Management**: Complete order lifecycle with tracking and status updates
- **Payment Processing**: Secure payments via Razorpay integration
- **Analytics**: Store performance analytics and sales tracking

### 🎯 Gaming Features

- **Live Streams**: Share and view live gaming streams with real-time chat
- **Arena Events**: Gaming tournaments and matchmaking system
- **Gaming Dashboard**: Centralized hub for all gaming activities

### 🎨 UI/UX Features

- **Gaming-inspired Dark Theme**: Modern purple/pink gradient design
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Loading States**: Smooth loading animations and skeletons
- **Error Handling**: User-friendly error messages and retry mechanisms
- **Toast Notifications**: Real-time feedback for user actions

---

## Tech Stack

### Backend

- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with HTTP-only cookies
- **Real-time**: Socket.io for live features
- **File Upload**: Multer + Cloudinary integration
- **Email**: Nodemailer for email services
- **Payments**: Razorpay for secure transactions
- **Security**: CORS, rate limiting, input validation

### Frontend

- **Framework**: React 18 with Vite build tool
- **Routing**: React Router v6 with protected routes
- **Styling**: Tailwind CSS with custom gaming theme
- **State Management**: React Context API (Auth, Store, Product, Notification)
- **HTTP Client**: Axios with interceptors
- **Icons**: Lucide React icon library
- **Notifications**: React Toastify
- **Real-time**: Socket.io client

### Infrastructure

- **Media Storage**: Cloudinary for images/videos
- **Payment Gateway**: Razorpay for transactions
- **Email Service**: Gmail SMTP via Nodemailer
- **Development**: Hot reload, proxy setup, ESLint configuration

---

## Project Structure

```
livestream/
├── backend/                    # Express.js API server
│   ├── config/                # Service configurations
│   │   ├── cloudinary.js      # Cloudinary setup
│   │   ├── multrer.js         # File upload configuration
│   │   ├── nodeMailer.js      # Email service setup
│   │   └── rozapay.js         # Razorpay payment gateway
│   ├── controllers/           # Business logic
│   │   ├── Chat/              # Chat and messaging
│   │   ├── Notification/      # Notification system
│   │   ├── Post/              # Posts and social features
│   │   ├── Profile/           # User profile management
│   │   ├── Store/             # E-commerce functionality
│   │   ├── Stream/            # Live streaming
│   │   └── User/              # User authentication
│   ├── db/
│   │   └── ConnectDB.js       # MongoDB connection
│   ├── middleware/
│   │   ├── Auth.js            # JWT authentication
│   │   └── verifyStore.js     # Store ownership verification
│   ├── models/                # Mongoose schemas
│   │   ├── User.models.js     # User schema
│   │   ├── Post.models.js     # Post schema
│   │   ├── Store.models.js    # Store schema
│   │   ├── Product.models.js  # Product schema
│   │   ├── Order.models.js    # Order schema
│   │   ├── Cart.models.js     # Shopping cart schema
│   │   └── ...               # Other models
│   ├── route/                 # API route definitions
│   ├── services/              # Business services
│   ├── socket/                # Socket.io handlers
│   ├── uploads/               # Local file storage
│   └── server.js              # Application entry point
├── client/                    # React frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Navbar/       # Navigation component
│   │   │   ├── ProfilePage/  # User profile components
│   │   │   ├── Post/         # Post-related components
│   │   │   ├── ChatPage/     # Chat application
│   │   │   ├── Notification/ # Notification system
│   │   │   ├── LoginForm/    # Authentication forms
│   │   │   ├── RegistrationForm/
│   │   │   ├── ForgetPassword/
│   │   │   └── Footer/
│   │   ├── Store/           # E-commerce components
│   │   │   ├── components/  # Store management
│   │   │   ├── product/     # Product management
│   │   │   ├── search/      # Product search & wishlist
│   │   │   ├── Card/        # Shopping cart
│   │   │   └── analysis/    # Store analytics
│   │   ├── context/         # React Context providers
│   │   │   ├── AuthContext.jsx
│   │   │   ├── StoreContext.jsx
│   │   │   ├── ProductContext.jsx
│   │   │   ├── NotificationContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── assets/          # Images and media
│   │   ├── styles.css       # Custom CSS
│   │   ├── App.jsx          # Main application component
│   │   └── main.jsx         # React entry point
│   ├── vite.config.js       # Vite configuration
│   ├── package.json         # Dependencies
│   └── README.md            # Client documentation
├── server/                  # Streaming server config
│   └── stream.conf          # NGINX RTMP configuration
└── README.md               # This file
```

---

## Database Models

### Core Models

- **User**: Authentication, profile, social connections
- **Post**: Social media posts with likes/comments
- **Message**: Direct messaging system
- **Conversation**: Chat conversations
- **Notification**: Real-time notifications

### E-commerce Models

- **Store**: User-owned stores
- **Product**: Store products with images, pricing, inventory
- **Cart**: Shopping cart with multiple store support
- **Order**: Complete order lifecycle management
- **Address**: Delivery addresses

### Features

- MongoDB indexes for performance
- Mongoose middleware for validation
- Aggregation pipelines for analytics
- GeoJSON for location data

---

## Real-time Features

### Socket.io Integration

- **Chat System**: Real-time messaging with typing indicators
- **Notifications**: Live notification delivery
- **Live Streams**: Real-time stream events
- **User Presence**: Online/offline status tracking

### Event Types

- New messages and conversations
- User typing indicators
- Notification delivery
- Stream start/end events
- User connection status

---

## Payment Integration

### Razorpay Features

- Secure payment processing
- Order creation and verification
- Payment status tracking
- Refund handling
- Multi-currency support

### Order Management

- Stock validation and updates
- Order status tracking
- Delivery management
- Payment verification
- Order history

---

## Backend Overview

### Architecture

- **RESTful API** design with Express.js
- **JWT Authentication** with HTTP-only cookies
- **Role-based Access Control** for store owners
- **File Upload** handling with Multer and Cloudinary
- **Real-time Communication** via Socket.io
- **Payment Processing** with Razorpay integration

### Key Features

- Input validation and sanitization
- Error handling middleware
- Rate limiting for API protection
- CORS configuration for cross-origin requests
- Database connection pooling
- Cloudinary integration for media management

---

## Frontend Overview

### Architecture

- **React 18** with functional components and hooks
- **Context API** for global state management
- **Protected Routes** for authenticated users
- **Responsive Design** with Tailwind CSS
- **Real-time Updates** via Socket.io client

### Key Components

- **Navbar**: Navigation with user menu and notifications
- **Dashboard**: Gaming-inspired home page
- **Profile**: User profile management with image uploads
- **Chat**: Real-time messaging application
- **Store**: Complete e-commerce interface
- **Products**: Product browsing and management
- **Cart**: Shopping cart with checkout flow
- **Orders**: Order history and tracking

### State Management

- **AuthContext**: User authentication and profile
- **StoreContext**: Store management
- **ProductContext**: Product and cart operations
- **NotificationContext**: Real-time notifications

---

## Setup & Installation

### Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- Cloudinary account
- Razorpay account
- Gmail account for email services

### 1. Clone Repository

```bash
git clone https://github.com/aditya-raut/livestream.git
cd livestream
```

### 2. Backend Setup

```bash
cd backend
npm install

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd client
npm install

# Start development server
npm run dev
```

### 4. Access Application

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## Environment Variables

### Backend (.env)

```env
# Database
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email (Gmail SMTP)
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password

# Server
PORT=5000
NODE_ENV=development
```

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ESLint configuration provided
- Follow React best practices
- Write meaningful commit messages
- Add comments for complex logic

---

## License

This project is licensed under the ISC License.

**© 2025 Aditya Raut**

---

## Acknowledgments

- Gaming community for inspiration
- Open source contributors
- React and Node.js communities
- Tailwind CSS for the design system
- Lucide React for beautiful icons

---
