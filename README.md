# Monies - Your Complete Financial Management Platform

<div align="center">
  <img src="/public/logo.png" alt="Monies Logo" width="150" />
  <h3>Track every penny.</h3>
</div>

## Overview

Monies is a comprehensive financial management platform designed to help you take control of your finances. From expense tracking to budget management, debt tracking, and AI-powered financial advice, Monies provides all the tools you need to manage your money effectively in one place.

## Features

### 💰 Dashboard
- Get a complete overview of your financial health
- View income vs. expenses
- Track account balances
- Monitor budget progress

### 💸 Methods of adding Transactions
- Manually
- Through voice
- Through scan receipt with AI
- Through import of card statement

### 📊 Transaction Management
- Track all your income and expenses
- Add receipts to transactions
- Set up recurring transactions

### 📝 Budget Planning
- Create and manage budgets
- Get alerts when approaching budget limits
- Visualize budget utilization
- Track spending patterns

### 🤝 Personal and Group Expense Management
- Keep track of money you've borrowed or lent
- Maintain a running balance with each person
- Add, edit, and delete transactions
- Clear visual indicators for money owed to you vs. money you owe
- Make groups for group expenses

### 🤖 Fina - AI Financial Assistant
- Get personalized financial advice
- Ask questions about your spending habits
- Receive budgeting recommendations
- Plan for financial goals

## Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Styling**: Tailwind CSS, Shadcn UI
- **State Management**: React Hooks
- **AI Integration**: Gemini API

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/monies.git
   cd monies
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL=your_postgresql_connection_string
   DIRECT_URL=your_direct_postgresql_connection_string
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   GEMINI_API_KEY=your_gemini_api_key (optional, for AI features)
   RESEND_API_KEY=your_resend_api_key
   ARCJET_KEY=your_arcjet_api_key
   INNGEST_SIGNING_KEY=your_inngest_signing_key
   INNGEST_EVENT_KEY=your_inngest_event_key
   
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request



---

<div align="center">
  <p>Built with ❤️ for better financial management</p>
</div>
