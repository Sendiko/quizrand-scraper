# Quiz Web Scraper — Setup & Execution Guide

This guide provides instructions for **Antigravity** (or any engineer/agent) to set up and execute the Node.js web scraper designed to extract quiz data (questions, choices, and correct answers) from ExamTopics HTML pages.

---

## 📋 Prerequisites

Ensure the target system has the following installed:

* **Node.js**: Version `18.0.0` or higher
* **npm**: Version `9.0.0` or higher (comes bundled with Node.js)

Verify your environment by running:
```bash
node -v
npm -v
```

---

## 📁 Project Directory Setup

1. Create a new directory for the project and navigate into it:
   ```bash
   mkdir quiz-scraper
   cd quiz-scraper
   ```

2. Initialize a new Node.js project:
   ```bash
   npm init -y
   ```

3. Enable **ES Module support** (`import/export` syntax) in `package.json`:
   ```bash
   npm pkg set type="module"
   ```

---

## 📦 Dependencies Installation

Install the required production dependencies:

```bash
npm install axios cheerio
```

* **`axios`**: Fast HTTP client to fetch HTML markup.
* **`cheerio`**: Server-side DOM parser and selector library (jQuery-like syntax).

---

## 📄 Code Implementation

1. Create a file named `scraper.js`:
   ```bash
   touch scraper.js
   ```

2. Add the following code into `scraper.js`:

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

async function scrapeQuizPage(url) {
  try {
    console.log(`[+] Fetching URL: ${url}`);
    
    // 1. Fetch HTML markup with custom User-Agent header
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    // 2. Load into Cheerio DOM selector
    const $ = cheerio.load(html);
    const questions = [];

    // 3. Loop through each question card
    $('.exam-question-card').each((_, element) => {
      const questionHeader = $(element).find('.card-header').text().trim().replace(/\s+/g, ' ');
      const questionText = $(element).find('.card-text').first().text().trim().replace(/\s+/g, ' ');
      const correctAnswer = $(element).find('.correct-answer').text().trim();

      const choices = [];
      $(element).find('.question-choices-container li').each((_, choiceEl) => {
        choices.push($(choiceEl).text().trim().replace(/\s+/g, ' '));
      });

      questions.push({
        header: questionHeader,
        question: questionText,
        choices: choices,
        correctAnswer: correctAnswer
      });
    });

    // 4. Save parsed results to JSON file
    const outputFile = 'quiz_data.json';
    await fs.writeFile(outputFile, JSON.stringify(questions, null, 2));
    
    console.log(`[✔] Successfully scraped ${questions.length} questions.`);
    console.log(`[✔] Results saved to: ${outputFile}`);
  } catch (error) {
    console.error(`[✘] Scraping failed: ${error.message}`);
  }
}

// Target URL to scrape
const TARGET_URL = 'https://www.examtopics.com/exams/amazon/aws-certified-solutions-architect-associate-saa-c02/view/';

scrapeQuizPage(TARGET_URL);
```

---

## 🚀 Execution Instructions

Run the scraper script using Node.js:

```bash
node scraper.js
```

### Expected Output in Console:
```text
[+] Fetching URL: https://www.examtopics.com/exams/amazon/aws-certified-solutions-architect-associate-saa-c02/view/
[✔] Successfully scraped 10 questions.
[✔] Results saved to: quiz_data.json
```

---

## 📊 Output File Format

The output file `quiz_data.json` will be formatted as follows:

```json
[
  {
    "header": "Question #1 Topic 1",
    "question": "A solutions architect is designing a solution where users will be directed to a backup static error page if the primary website is unavailable...",
    "choices": [
      "A. Point a Route 53 alias record to an Amazon CloudFront distribution...",
      "B. Set up a Route 53 active-passive failover configuration...",
      "C. Update the Route 53 record to use a latency-based routing policy...",
      "D. Set up a Route 53 active-active configuration..."
    ],
    "correctAnswer": "B"
  }
]
```

---

## ⚠️ Troubleshooting & Edge Cases

* **Cloudflare / Bot Detection**:
  If requests fail with `403 Forbidden` or CAPTCHA errors, replace `axios` with **Playwright** to run inside a headless browser environment:
  ```bash
  npm install playwright
  ```
* **Offline HTML Processing**:
  If working with pre-downloaded HTML files, load the file directly using `fs.readFile()` and pass the raw HTML string into `cheerio.load(htmlContent)`.
