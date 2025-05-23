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
  <img src="./Docs/demo.gif" alt="DisposableMail Finder Interface" width="600">
</div>

## ✨ Key Features

- **Comprehensive Email Checking**: Identifies disposable email, privacy-focused email, free email providers and university email around the world
- **DNS Verification**: Checks MX records and DMARC policies for domains
- **External API Integration**: Falls back to third-party verification if the domain isn't found in the disposable list but has a pattern similar to disposable domains
- **Self-Learning**: Automatically adds newly discovered disposable domains
- **Robust Security**: Implements multiple layers of protection against common web vulnerabilities
- **Mobile-Friendly UI**: Responsive design works on all devices
- **User-Friendly Interface**: Simple and intuitive design for easy navigation while being accessible.
- **Dark Mode Support**: Automatically adapts to system preferences

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Basic knowledge of command line operations

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Somorr/Disposable-Mail-Finder.git
   cd disposablemail-finder
   ```
2. install:
   ``` bash 
   npm run install
   npm run build
   ```
3. Start the server:
   ```bash 
   npm run dev        # for development
   npm run start      # for production
   ```
   
4. Optional - if you want the server to check for new disposable domains using third-party API:

Make sure to do `npm install` than `npm run build` and then `npm run dev` as asked in the previous steps. Once made a new file will be created in this following path `/data/verifymail_api.txt`. You can get a free API key from [VerifyMail](https://verifymail.io/) once account created and you activate your account go to [dashboard](https://verifymail.io/dashboard) and scroll to API Key section and copy and past the api key in `verifymail_api.txt`.
Note that the file `verifymail_api.txt` can support multiple API keys, one per line.
