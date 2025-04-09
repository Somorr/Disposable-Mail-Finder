# DisposableMail Finder

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-18.x-green" alt="Node.js 18.x">
  <img src="https://img.shields.io/badge/Express-4.x-blue" alt="Express 4.x">
  <img src="https://img.shields.io/badge/Security-Enhanced-orange" alt="Security Enhanced">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT">
</div>

<p align="center">
  <strong>Identify disposable, privacy-focused, and free email providers with ease</strong>
</p>

## 📋 Overview

DisposableMail Finder is a secure web application that helps you verify whether an email address comes from a disposable provider, a privacy-focused service, or a common free email domain. It provides detailed information including DNS records to help you make informed decisions about email legitimacy.

<div align="center">
  <img src="docs/screenshot.png" alt="DisposableMail Finder Interface" width="600">
</div>

## ✨ Key Features

- **Comprehensive Email Checking**: Identifies disposable, privacy-focused, and free email providers
- **DNS Verification**: Checks MX records and DMARC policies for domains
- **External API Integration**: Falls back to third-party verification for unknown domains
- **Self-Learning**: Automatically adds newly discovered disposable domains
- **Robust Security**: Implements multiple layers of protection against common web vulnerabilities
- **Mobile-Friendly UI**: Responsive design works on all devices
- **Dark Mode Support**: Automatically adapts to system preferences

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Basic knowledge of command line operations

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/disposablemail-finder.git
   cd disposablemail-finder
   ```
2. install:
   ``` bash 
   npm run install
   npm run build
   ```
3. Start the server:```
   ```bash 
   npm run dev        # for development
   npm run start      # for production
   ```
