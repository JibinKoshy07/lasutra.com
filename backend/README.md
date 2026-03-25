# LaSutra Backend - Node.js + PostgreSQL

This is the backend API for the LaSutra Boutique e-commerce application.

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)

## Setup

1. **Install PostgreSQL** and create a database:
   ```sql
   CREATE DATABASE lasutra;
   ```

2. **Configure database credentials**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

The server will run on `http://localhost:3000`

## Database Schema

The following tables are automatically created:
- `users` - User accounts
- `orders` - Customer orders
- `order_items` - Items in each order

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Orders
- `POST /api/orders` - Create a new order
- `GET /api/orders/:userId` - Get user's order history

### Users
- `GET /api/users/:id` - Get user by ID

## Environment Variables

```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=lasutra
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3000
```

## Frontend Connection

The frontend connects to `http://localhost:3000/api`. Make sure the backend is running before using the webapp.
