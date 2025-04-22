document.addEventListener('DOMContentLoaded', () => {
  const emailForm = document.getElementById('email-form');
  const emailInput = document.getElementById('email-input');
  const submitBtn = document.getElementById('submit-btn');
  const resultDiv = document.getElementById('result');
  const resultMessage = document.getElementById('result-message');
  const resultDetails = document.getElementById('result-details');
  const fileWarningsDiv = document.getElementById('file-warnings');

  // Security-focused utility functions
  const utils = {
    // Sanitize strings to prevent XSS
    sanitize: (str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    // Validate email format
    isValidEmail: (email) => {
      // RFC 5322 compliant email regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return emailRegex.test(String(email).toLowerCase());
    },

    // Create safe HTML elements
    createSafeElement: (tagName, attributes = {}, textContent = '') => {
      const element = document.createElement(tagName);

      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string') {
          element.setAttribute(key, value);
        }
      });

      if (textContent) {
        element.textContent = textContent;
      }

      return element;
    },

    // Safer alternative to innerHTML
    setContent: (element, content) => {
      // Clear existing content
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }

      if (typeof content === 'string') {
        // Use DOMParser to safely create elements
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const children = doc.body.childNodes;

        // Append each child node to the element
        Array.from(children).forEach(node => {
          element.appendChild(node.cloneNode(true));
        });
      } else if (content instanceof Node) {
        element.appendChild(content);
      }
    }
  };

  // Initialize CSRF protection
  const csrfToken = initCsrfProtection();

  // Check for missing data files
  checkFileStatus();

  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) {
      showError('Please enter an email address');
      return;
    }

    // Client-side email validation
    if (!utils.isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Clear previous results
    resultDiv.className = 'result';

    // Completely clear the result message
    while (resultMessage.firstChild) {
      resultMessage.removeChild(resultMessage.firstChild);
    }

    // Show loading text instead of spinner
    resultMessage.textContent = "Checking email...";

    // Clear previous details
    while (resultDetails.firstChild) {
      resultDetails.removeChild(resultDetails.firstChild);
    }

    // Show the result div
    resultDiv.classList.remove('hidden');

    try {
      // Add throttling to prevent too many requests
      submitBtn.disabled = true;
      setTimeout(() => { submitBtn.disabled = false; }, 1000);

      // Make API call to check the email with CSRF protection
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const result = await response.json();
      displayResult(result);

    } catch (error) {
      console.error('Error checking email:', error);
      resultDiv.classList.remove('hidden');
      resultDiv.className = 'result system-message';
      resultMessage.textContent = 'An error occurred while checking the email. Please try again.';
    }
  });

  // Focus email input when page loads
  emailInput.focus();

  // Allow pressing Enter to submit the form
  emailInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitBtn.click();
    }
  });

  // Initialize CSRF protection
  function initCsrfProtection() {
    // Create a random token for CSRF protection
    const token = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Store in session storage
    sessionStorage.setItem('csrfToken', token);

    return token;
  }

  // Check the status of data files
  async function checkFileStatus() {
    try {
      const response = await fetch('/api/file-status', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const status = await response.json();
      const missingFiles = [];

      if (!status.disposable) missingFiles.push('disposable.txt');
      if (!status.privacy) missingFiles.push('privacy.txt');
      if (!status.free) missingFiles.push('free_provider.txt');
      if (!status.university) missingFiles.push('universities.txt');

      // Check for API keys
      if (!status.verifyMailApiKeys) {
        missingFiles.push('verifymail_api.txt (no valid API keys)');
      }

      if (missingFiles.length > 0) {
        showFileWarning(missingFiles);
      }
    } catch (error) {
      console.error('Error checking file status:', error);
    }
  }

  // Show warning for missing files
  function showFileWarning(missingFiles) {
    // Create elements safely
    const warningDiv = utils.createSafeElement('div', { class: 'file-warning' });

    const icon = utils.createSafeElement('i', {
      class: 'fas fa-exclamation-triangle file-warning-icon'
    });

    const contentDiv = utils.createSafeElement('div');
    const strongText = utils.createSafeElement('strong', {}, 'Missing data files:');

    contentDiv.appendChild(strongText);
    contentDiv.appendChild(document.createTextNode(' Some data files were not found and have been created with placeholder content. '));
    contentDiv.appendChild(document.createTextNode(`Add more content to ${missingFiles.join(', ')} in the data directory for better results.`));

    warningDiv.appendChild(icon);
    warningDiv.appendChild(contentDiv);

    // Clear any existing content and append new warning
    while (fileWarningsDiv.firstChild) {
      fileWarningsDiv.removeChild(fileWarningsDiv.firstChild);
    }
    fileWarningsDiv.appendChild(warningDiv);
  }

  // Function to display result
  function displayResult(result) {
    resultDiv.className = 'result';

    // Determine the main classification and message
    if (result.isDisposable) {
      resultDiv.classList.add('disposable');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from a disposable email provider.`;

      const detailsFragment = document.createDocumentFragment();

      if (result.source) {
        const sourcePara = utils.createSafeElement('p');
        const sourceText = document.createTextNode('This email is associated with ');
        const sourceStrong = utils.createSafeElement('strong', {}, utils.sanitize(result.source));
        const sourceTextEnd = document.createTextNode(' which provides temporary email addresses.');

        sourcePara.appendChild(sourceText);
        sourcePara.appendChild(sourceStrong);
        sourcePara.appendChild(sourceTextEnd);
        detailsFragment.appendChild(sourcePara);
      }

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'Disposable email addresses are often used to avoid providing a real email address for registration.'
      );
      detailsFragment.appendChild(infoPara);

      // Add DMARC info if it matches temp-mail.org
      if (result.dmarc && result.dmarc.isTempMailDmarc) {
        const dmarcPara = utils.createSafeElement(
            'p',
            { class: 'important-info' },
            'This domain uses a DMARC record that is specific to temp-mail.org, confirming it is a disposable email service.'
        );
        detailsFragment.appendChild(dmarcPara);
      }

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }
    else if (result.isPrivacy) {
      resultDiv.classList.add('privacy');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from a privacy-focused email provider.`;

      const detailsFragment = document.createDocumentFragment();

      const sourcePara = utils.createSafeElement('p');
      const sourceText = document.createTextNode('This email is associated with ');
      const sourceStrong = utils.createSafeElement('strong', {}, utils.sanitize(result.source));
      const sourceTextEnd = document.createTextNode(' which is known for enhanced privacy.');

      sourcePara.appendChild(sourceText);
      sourcePara.appendChild(sourceStrong);
      sourcePara.appendChild(sourceTextEnd);

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'Privacy-focused email providers often offer additional security features like encryption.'
      );

      detailsFragment.appendChild(sourcePara);
      detailsFragment.appendChild(infoPara);

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }
    else if (result.isUniversity) {
      resultDiv.classList.add('university');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from a university email domain.`;

      const detailsFragment = document.createDocumentFragment();

      const uniNamePara = utils.createSafeElement('p');
      const uniText = document.createTextNode('This email is associated with ');
      const uniStrong = utils.createSafeElement('strong', {}, utils.sanitize(result.universityName || 'a university'));
      const uniTextEnd = document.createTextNode('.');

      uniNamePara.appendChild(uniText);
      uniNamePara.appendChild(uniStrong);
      uniNamePara.appendChild(uniTextEnd);

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'University email addresses are typically issued to students, faculty, and staff of educational institutions.'
      );

      const validPara = utils.createSafeElement(
          'p',
          { class: 'important-info' },
          'Educational email addresses are generally considered reliable and legitimate.'
      );

      detailsFragment.appendChild(uniNamePara);
      detailsFragment.appendChild(infoPara);
      detailsFragment.appendChild(validPara);

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }
    else if (result.isMailboxOrg) {
      resultDiv.classList.add('free');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from mailbox.org.`;

      const detailsPara = utils.createSafeElement(
          'p',
          {},
          'While mailbox.org is a legitimate email service, it offers a 30-day free trial after which users must pay. Some users create accounts for the trial period only and abandon them, effectively using them as disposable emails.'
      );

      const strongNote = utils.createSafeElement('strong', {}, 'Note about mailbox.org:');
      detailsPara.insertBefore(strongNote, detailsPara.firstChild);

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsPara);
    }
    else if (result.isFreeProvider) {
      resultDiv.classList.add('free');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from a common free email provider.`;

      const detailsFragment = document.createDocumentFragment();

      const domainPara = utils.createSafeElement(
          'p',
          {},
          `This domain (${utils.sanitize(result.domain)}) is a common free email service.`
      );

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'Free email providers are legitimate services used by millions of people.'
      );

      detailsFragment.appendChild(domainPara);
      detailsFragment.appendChild(infoPara);

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }
    else if (result.hasWeakSecurity) {
      resultDiv.classList.add('unknown');
      resultMessage.textContent = `${utils.sanitize(result.email)} is from a domain with weak security.`;

      const detailsFragment = document.createDocumentFragment();

      const warningPara = utils.createSafeElement(
          'p',
          { class: 'warning-text' },
          `The domain ${utils.sanitize(result.domain)} has email servers (MX records) but lacks DMARC protection.`
      );

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'Without proper email authentication protocols, this domain is vulnerable to sender spoofing, making it difficult to trust emails that claim to be from this source.'
      );

      const cautionPara = utils.createSafeElement(
          'p',
          { class: 'important-info' },
          'This may be a legitimate email, but you should exercise caution when receiving messages from this domain.'
      );

      detailsFragment.appendChild(warningPara);
      detailsFragment.appendChild(infoPara);
      detailsFragment.appendChild(cautionPara);

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }
    else {
      resultDiv.classList.add('unknown');
      resultMessage.textContent = `${utils.sanitize(result.email)} appears to be from a regular email domain.`;

      const detailsFragment = document.createDocumentFragment();

      const domainPara = utils.createSafeElement(
          'p',
          {},
          `The domain ${utils.sanitize(result.domain)} is not in our list of known disposable, privacy, free, or university email providers.`
      );

      const infoPara = utils.createSafeElement(
          'p',
          {},
          'This could be a custom domain, business email, or other institutional email.'
      );

      detailsFragment.appendChild(domainPara);
      detailsFragment.appendChild(infoPara);

      // Add info about API check if performed
      if (result.apiChecked) {
        const apiPara = utils.createSafeElement(
            'p',
            {},
            'This domain was also verified with the VerifyMail API and was not identified as a disposable email provider.'
        );
        detailsFragment.appendChild(apiPara);
      }

      // Clear and append new content
      while (resultDetails.firstChild) {
        resultDetails.removeChild(resultDetails.firstChild);
      }
      resultDetails.appendChild(detailsFragment);
    }

    // Add MX record information if available
    if (result.mx) {
      addMxRecordsSection(result.mx);
    }

    // Add DMARC information only if MX records exist
    if (result.mx && result.mx.hasMx && result.dmarc) {
      addDmarcSection(result.dmarc);
    }
  }

  // Add MX records section
  function addMxRecordsSection(mxResult) {
    const mxSection = utils.createSafeElement('div', { class: 'dns-section' });
    const sectionTitle = utils.createSafeElement('h3', {}, 'MX Records');
    mxSection.appendChild(sectionTitle);

    if (mxResult.hasMx && mxResult.records.length > 0) {
      const mxPara = utils.createSafeElement('p', {}, 'This domain has valid mail exchanger (MX) records:');
      mxSection.appendChild(mxPara);

      const mxRecordsContainer = utils.createSafeElement('div', { class: 'mx-records-container' });

      mxResult.records.forEach(record => {
        const mxRecordDiv = utils.createSafeElement('div', { class: 'mx-record' });

        const hostnameSpan = utils.createSafeElement('span', { class: 'mx-hostname' }, utils.sanitize(record.hostname));
        const prioritySpan = utils.createSafeElement('span', { class: 'mx-priority' }, `(priority: ${record.priority})`);
        const ipSpan = utils.createSafeElement('span', { class: 'mx-ip' }, utils.sanitize(record.ip));

        mxRecordDiv.appendChild(hostnameSpan);
        mxRecordDiv.appendChild(prioritySpan);
        mxRecordDiv.appendChild(ipSpan);

        mxRecordsContainer.appendChild(mxRecordDiv);
      });

      mxSection.appendChild(mxRecordsContainer);
    } else {
      const noMxPara = utils.createSafeElement(
          'p',
          { class: 'warning-text' },
          'No valid MX records found for this domain. This domain may not be able to receive emails.'
      );
      mxSection.appendChild(noMxPara);
    }

    resultDetails.appendChild(mxSection);
  }

  // Add DMARC section
  function addDmarcSection(dmarcResult) {
    const dmarcSection = utils.createSafeElement('div', { class: 'dns-section' });
    const sectionTitle = utils.createSafeElement('h3', {}, 'DMARC Policy');
    dmarcSection.appendChild(sectionTitle);

    if (dmarcResult.hasDmarc) {
      const dmarcPara = utils.createSafeElement('p', {}, 'This domain has a DMARC policy in place:');
      const dmarcRecord = utils.createSafeElement('div', { class: 'dmarc-record' }, utils.sanitize(dmarcResult.record));

      dmarcSection.appendChild(dmarcPara);
      dmarcSection.appendChild(dmarcRecord);

      // Add specific message for temp-mail.org DMARC
      if (dmarcResult.isTempMailDmarc) {
        const warningPara = utils.createSafeElement(
            'p',
            { class: 'warning-text' },
            'This DMARC record matches the exact configuration used by temp-mail.org disposable emails.'
        );
        dmarcSection.appendChild(warningPara);
      }
    } else {
      const noDmarcPara1 = utils.createSafeElement(
          'p',
          { class: 'warning-text' },
          'No DMARC policy found for this domain. This makes the domain more vulnerable to email spoofing and phishing attacks.'
      );

      const noDmarcPara2 = utils.createSafeElement(
          'p',
          {},
          'Without email authentication protocols like DMARC in place, malicious actors can more easily send emails that appear to come from this domain.'
      );

      dmarcSection.appendChild(noDmarcPara1);
      dmarcSection.appendChild(noDmarcPara2);
    }

    resultDetails.appendChild(dmarcSection);
  }

  // Function to show error message
  function showError(message) {
    resultDiv.className = 'result system-message';
    resultMessage.textContent = utils.sanitize(message);

    // Clear result details
    while (resultDetails.firstChild) {
      resultDetails.removeChild(resultDetails.firstChild);
    }

    resultDiv.classList.remove('hidden');

    // Automatically hide after 3 seconds
    setTimeout(() => {
      if (resultMessage.textContent === utils.sanitize(message)) {
        resultDiv.classList.add('hidden');
      }
    }, 3000);

    // Set focus back to the input
    emailInput.focus();
  }

  // Add event listeners to detect and warn about browser auto-fill
  emailInput.addEventListener('animationstart', (e) => {
    if (e.animationName === 'autofill') {
      // Validate the auto-filled value
      setTimeout(() => {
        const autoFilledValue = emailInput.value.trim();
        if (autoFilledValue && !utils.isValidEmail(autoFilledValue)) {
          emailInput.value = ''; // Clear invalid auto-filled value
          showError('Auto-filled email appears to be invalid. Please enter manually.');
        }
      }, 100);
    }
  });

  // Security-focused feature: Auto-logout on inactivity
  let inactivityTimer;

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    // 30 minutes of inactivity will reload the page
    inactivityTimer = setTimeout(() => {
      window.location.reload();
    }, 30 * 60 * 1000);
  }

  // Reset timer on user interaction
  ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, false);
  });

  // Initialize inactivity timer
  resetInactivityTimer();
});

// Add CSS animation for detecting autofill
const style = document.createElement('style');
style.textContent = `
  @keyframes autofill {
    from {}
    to {}
  }
  
  input:-webkit-autofill {
    animation-name: autofill;
    animation-fill-mode: both;
  }
  
  /* University email styling */
  .result.university::before {
    background-color: #8a2be2; /* Purple color for universities */
  }
  
  .result.university {
    background-color: #f8f0ff; /* Light purple background */
  }
  
  @media (prefers-color-scheme: dark) {
    .result.university {
      background-color: #3a2a4a; /* Dark purple background for dark mode */
    }
  }
  `;
document.head.appendChild(style);