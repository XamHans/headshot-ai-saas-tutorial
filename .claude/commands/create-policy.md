---
description: Analyzes the codebase and generates a Next.js privacy policy page based on the official template.
allowed-tools: Read, Grep, Glob, Bash
---

**Objective:** Create a comprehensive privacy policy page for this Next.js application using the required template.

**Two-Step Workflow:**

1.  **Step 1: Analyze the Codebase**
    First, invoke the `codebase-analyzer` subagent. Instruct it to scan the entire project and produce a structured summary of all data collection points, third-party services (Vercel, Umami, Neon), cookie usage, and payment processors.

2.  **Step 2: Craft the Page**
    Next, take the analysis from Step 1 and use it to populate the template below. Then, invoke the `privacy-creator` subagent and instruct it to create the `app/privacy/page.tsx` file with the final, populated content.

---

**Template for `app/privacy/page.tsx` (Based on your provided markdown):**

```tsx
import { type Metadata } from 'next';
import Link from 'next/link';

// SEO Metadata for the Privacy Policy page
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how we collect, use, and safeguard your personal information.',
};

// A reusable component for better structure and readability
const PolicySection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-8">
    <h2 className="text-2xl font-bold mb-4">{title}</h2>
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      {children}
    </div>
  </section>
);

export default function PrivacyPolicyPage() {
  const lastUpdatedDate = 'September 24, 2025'; // Or make this dynamic
  const contactEmail = 'your-email@example.com';

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-lg text-neutral-500 dark:text-neutral-400">
          <strong>Last updated:</strong> {lastUpdatedDate}
        </p>
      </header>

      <main>
        <p className="mb-8">
          This Privacy Policy outlines how we collect, use, and safeguard your
          personal information when you interact with our website and services.
        </p>

        <PolicySection title="Personal Information We Collect">
          <p>We collect personal information only when necessary, such as:</p>
          <ul>
            {/* Populated by codebase-analyzer */}
            <li>
              <strong>
                [Agent to list data collected, e.g., Name and Email Address]
              </strong>
              : When you contact us via our support form or email.
            </li>
            <li>
              <strong>
                [Agent to list data collected, e.g., Payment Information]
              </strong>
              : When you purchase our products/services, processed securely by our
              payment provider, [Your Payment Provider].
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="How We Use Your Information">
          <p>We use your information to:</p>
          <ul>
            {/* Populated by codebase-analyzer */}
            <li>
              [Agent to list uses, e.g., Respond to your inquiries and provide
              customer support.]
            </li>
            <li>
              [Agent to list uses, e.g., Process transactions and deliver
              purchased products.]
            </li>
            <li>Improve our website, products, and services.</li>
            <li>Ensure the security and integrity of our website.</li>
          </ul>
          <p>
            We do not share your personal information with third parties except
            as necessary to provide our services or as required by law.
          </p>
        </PolicySection>

        <PolicySection title="Cookies">
          <p>
            We use cookies to enhance your browsing experience and improve the
            functionality of our website. You can manage your cookie preferences
            through your browser settings. Please note that disabling cookies
            may affect the functionality of our website.
          </p>
        </PolicySection>

        <PolicySection title="Analytics">
          <p>
            We use Umami Analytics to collect anonymous data about how visitors
            use our website. Umami Analytics is a privacy-focused analytics tool
            that does not use cookies or collect personally identifiable
            information. This helps us understand website traffic and improve
            our services without compromising your privacy.
          </p>
        </PolicySection>

        <PolicySection title="Third-Party Services">
          <p>We use third-party services to support our website:</p>
          <ul>
            <li>
              <strong>Hosting Provider:</strong> Our website is hosted on
              Vercel. Vercel may collect data from visitors to our site,
              including IP addresses and location information, to provide their
              services. Please refer to Vercel's Privacy Policy for more
              information.
            </li>
            <li>
              <strong>Database Provider:</strong> We use Neon to store our
              application data. Neon has access to the data we collect as part
              of their service. Please refer to Neon's Privacy Policy for more
              information on how they handle your data.
            </li>
            {/* Populated by codebase-analyzer */}
            <li>
              <strong>
                [Agent to add any other third-party services, e.g., Payment
                Processing]
              </strong>
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Data Retention">
          <p>
            We retain your personal information only for as long as necessary to
            fulfill the purposes outlined in this policy or as required by law.
          </p>
        </PolicySection>

        <PolicySection title="Your Rights">
          <p>
            You have the right to access, correct, or delete any personal
            information we hold about you. To exercise these rights, please
            contact us at{' '}
            <Link href={`mailto:${contactEmail}`} className="underline">
              {contactEmail}
            </Link>
            .
          </p>
        </PolicySection>

        <PolicySection title="Changes to This Privacy Policy">
          <p>
            We reserve the right to update or modify this Privacy Policy at any
            time. Any changes will be posted on this page, and your continued
            use of our site signifies your acceptance of the updated policy.
          </p>
        </PolicySection>

        <PolicySection title="Contact Us">
          <p>
            If you have any questions or concerns about this Privacy Policy,
            please contact us at{' '}
            <Link href={`mailto:${contactEmail}`} className="underline">
              {contactEmail}
            </Link>
            .
          </p>
        </PolicySection>
      </main>
    </div>
  );
}
```
