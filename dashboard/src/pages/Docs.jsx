import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'cli-install', label: 'Install CLI' },
  { id: 'cli-commands', label: 'CLI Commands' },
  { id: 'sdk-android', label: 'Android SDK' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'rollout', label: 'Rollout & Rollback' },
  { id: 'team', label: 'Team & Roles' },
  { id: 'apk', label: 'APK Updates' },
];

function Code({ children, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="doc-code-block">
      <div className="doc-code-header">
        <span className="doc-code-lang">{lang}</span>
        <button className="doc-code-copy" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <pre className="doc-code-pre"><code>{children.trim()}</code></pre>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="doc-section">
      <h2 className="doc-h2">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="doc-subsection">
      <h3 className="doc-h3">{title}</h3>
      {children}
    </div>
  );
}

function Note({ children, type = 'info' }) {
  const icons = { info: 'ℹ️', tip: '💡', warning: '⚠️' };
  return (
    <div className={`doc-note doc-note-${type}`}>
      <span className="doc-note-icon">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="docs-layout">
      {/* TOC sidebar */}
      <aside className="docs-toc">
        <div className="docs-toc-title">Contents</div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`docs-toc-item ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <div className="docs-content">
        <div className="doc-hero">
          <div className="doc-hero-badge">Documentation</div>
          <h1 className="doc-hero-title">⚡ FastPush Docs</h1>
          <p className="doc-hero-desc">
            OTA update system for React Native — push JS bundle updates and APKs to your users without going through the App Store.
          </p>
        </div>

        {/* ── Overview ── */}
        <Section id="overview" title="Overview">
          <p className="doc-p">
            FastPush lets you push over-the-air (OTA) updates to your React Native Android app instantly.
            No App Store review required. Users get updates silently in the background.
          </p>
          <div className="doc-feature-grid">
            {[
              { icon: '📦', title: 'JS Bundle OTA', desc: 'Push JavaScript changes without a full app release.' },
              { icon: '📱', title: 'APK Distribution', desc: 'Push full native APKs for major version upgrades.' },
              { icon: '🎯', title: 'Gradual Rollout', desc: 'Roll out to 10% → 50% → 100% of users safely.' },
              { icon: '⏪', title: 'Instant Rollback', desc: 'Roll back a bad release in one click or one command.' },
              { icon: '👥', title: 'Team Collaboration', desc: 'Invite team members with Owner / Collaborator / Viewer roles.' },
              { icon: '📊', title: 'Analytics', desc: 'Track downloads, installs, and failures per release.' },
            ].map((f) => (
              <div key={f.title} className="doc-feature-card">
                <div className="doc-feature-icon">{f.icon}</div>
                <div className="doc-feature-title">{f.title}</div>
                <div className="doc-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Quick Start ── */}
        <Section id="quickstart" title="Quick Start">
          <p className="doc-p">Get up and running in under 5 minutes.</p>

          <SubSection title="Step 1 — Create an app">
            <p className="doc-p">
              Go to <Link to="/apps/create" className="doc-link">Apps → New App</Link>, enter your app name and choose platform (Android / iOS).
              FastPush will automatically create <strong>Production</strong> and <strong>Staging</strong> deployments for you.
            </p>
          </SubSection>

          <SubSection title="Step 2 — Install the CLI">
            <Code>{`npm install -g fastpush-cli`}</Code>
            <Code>{`fastpush login`}</Code>
          </SubSection>

          <SubSection title="Step 3 — Install the SDK in your RN app">
            <Code>{`npm install react-native-fastpush`}</Code>
          </SubSection>

          <SubSection title="Step 4 — Configure the SDK">
            <Code lang="javascript">{`
// App.js or index.js
import FastPush from 'react-native-fastpush';

FastPush.configure({
  serverUrl: 'https://your-fastpush-server.com',
  deploymentKey: 'YOUR_DEPLOYMENT_KEY',  // from Dashboard → Deployment
  appVersion: '1.0.0',
  deviceId: 'unique-device-id',
});

// Auto-sync on app start
useEffect(() => {
  FastPush.sync();
}, []);
            `}</Code>
          </SubSection>

          <SubSection title="Step 5 — Push your first release">
            <Code>{`
fastpush release \\
  --app MyApp \\
  --target-version "1.0.x" \\
  --description "First OTA release"
            `}</Code>
            <Note type="tip">Your users will receive the update the next time they open the app.</Note>
          </SubSection>
        </Section>

        {/* ── CLI Install ── */}
        <Section id="cli-install" title="Install CLI">
          <SubSection title="Requirements">
            <ul className="doc-list">
              <li>Node.js 16+</li>
              <li>npm or yarn</li>
            </ul>
          </SubSection>

          <SubSection title="Install">
            <Code>{`npm install -g fastpush-cli`}</Code>
          </SubSection>

          <SubSection title="Login">
            <Code>{`fastpush login`}</Code>
            <p className="doc-p">You will be prompted for your email and password. The token is saved at <code className="doc-inline-code">~/.fastpush/config.json</code>.</p>
          </SubSection>

          <SubSection title="Set server URL">
            <Code>{`fastpush server https://your-fastpush-server.com`}</Code>
            <Note>Run this once before any other command if your server is not localhost.</Note>
          </SubSection>
        </Section>

        {/* ── CLI Commands ── */}
        <Section id="cli-commands" title="CLI Commands">
          <Table
            headers={['Command', 'Description']}
            rows={[
              ['fastpush login', 'Login with email + password'],
              ['fastpush register', 'Create a new account'],
              ['fastpush server <url>', 'Set the FastPush server URL'],
              ['fastpush app create', 'Create a new app'],
              ['fastpush app list', 'List all your apps'],
              ['fastpush app info <name>', 'Show app details + deployment keys'],
              ['fastpush release [options]', 'Bundle and push a new release'],
              ['fastpush history <app>', 'Show release history'],
              ['fastpush rollback <app>', 'Roll back to the previous release'],
              ['fastpush promote <app>', 'Change rollout percentage'],
              ['fastpush metrics <app>', 'Show download / install analytics'],
            ]}
          />

          <SubSection title="fastpush release — all options">
            <Code>{`
fastpush release \\
  --app <app-name>           # required
  --target-version "1.0.x"  # required — semver range
  --deployment Production    # default: Production
  --description "Bug fixes"  # optional
  --mandatory                # force update, no skip button
  --rollout 10               # start at 10%, default: 100
  --type bundle              # bundle (default) or apk
  --file ./app-release.apk   # required for --type apk
            `}</Code>
          </SubSection>

          <SubSection title="Examples">
            <Code>{`
# Push JS bundle to Production
fastpush release --app MyApp --target-version "1.0.x" --description "Fix login bug"

# Push to Staging only
fastpush release --app MyApp --target-version "1.0.x" --deployment Staging

# Mandatory update
fastpush release --app MyApp --target-version "1.0.x" --mandatory

# Gradual rollout — start at 10%
fastpush release --app MyApp --target-version "1.0.x" --rollout 10

# Increase rollout to 50%
fastpush promote --app MyApp --version 5 --rollout 50

# Full rollout
fastpush promote --app MyApp --version 5 --rollout 100

# Rollback immediately
fastpush rollback --app MyApp

# View metrics
fastpush metrics --app MyApp
            `}</Code>
          </SubSection>
        </Section>

        {/* ── Android SDK ── */}
        <Section id="sdk-android" title="Android SDK Integration">
          <SubSection title="1. Install package">
            <Code>{`npm install react-native-fastpush`}</Code>
          </SubSection>

          <SubSection title="2. MainActivity.kt">
            <Code lang="kotlin">{`
package com.yourapp

import com.fastpush.FastPushConfig
import com.fastpush.UpdateManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
    override fun getMainComponentName() = "YourApp"

    // Redirect to downloaded bundle if available
    override fun getJSBundleFile(): String? {
        return UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
            .getJSBundleFile()
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
            `}</Code>
          </SubSection>

          <SubSection title="3. MainApplication.kt">
            <Code lang="kotlin">{`
import com.fastpush.FastPushConfig
import com.fastpush.FastPushPackage

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages() = PackageList(this).packages.apply {
            add(FastPushPackage())   // ← add this
        }
    }

    override fun onCreate() {
        super.onCreate()

        // Configure FastPush
        FastPushConfig.serverUrl = "https://your-fastpush-server.com"
        FastPushConfig.deploymentKey = "YOUR_DEPLOYMENT_KEY"

        // Auto-rollback on crash (optional but recommended)
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            UpdateManager(this, FastPushConfig.serverUrl!!, FastPushConfig.deploymentKey!!)
                .notifyCrash()
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }
}
            `}</Code>
          </SubSection>

          <SubSection title="4. AndroidManifest.xml — FileProvider (for APK install)">
            <Code lang="xml">{`
<manifest>
  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
  <uses-permission android:name="android.permission.INTERNET" />

  <application>
    <provider
      android:name="androidx.core.content.FileProvider"
      android:authorities="\${applicationId}.provider"
      android:exported="false"
      android:grantUriPermissions="true">
      <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
    </provider>
  </application>
</manifest>
            `}</Code>
            <p className="doc-p">Create <code className="doc-inline-code">res/xml/file_paths.xml</code>:</p>
            <Code lang="xml">{`
<?xml version="1.0" encoding="utf-8"?>
<paths>
  <files-path name="apk_files" path="." />
</paths>
            `}</Code>
          </SubSection>

          <SubSection title="5. JS API — Auto sync (recommended)">
            <Code lang="javascript">{`
import FastPush from 'react-native-fastpush';

FastPush.configure({
  serverUrl: 'https://your-fastpush-server.com',
  deploymentKey: 'YOUR_DEPLOYMENT_KEY',
  appVersion: '1.0.0',        // current native app version
  deviceId: 'unique-device-id',
});

// In your root component
useEffect(() => {
  FastPush.sync({
    onUpdateAvailable: (update) => {
      console.log('Update available:', update.version);
    },
    onProgress: (percent) => {
      console.log('Downloading:', percent + '%');
    },
  });
}, []);
            `}</Code>
          </SubSection>

          <SubSection title="6. JS API — Manual control">
            <Code lang="javascript">{`
const update = await FastPush.checkForUpdate();

if (!update) {
  console.log('Already up to date');
  return;
}

if (update.isMandatory) {
  // No skip allowed
  await FastPush.downloadAndApply(update, (progress) => setProgress(progress));
  await FastPush.reloadApp();
} else {
  Alert.alert(
    'Update Available',
    update.description || \`Version \${update.version} is ready\`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Update Now',
        onPress: async () => {
          await FastPush.downloadAndApply(update);
          await FastPush.reloadApp();
        },
      },
    ]
  );
}
            `}</Code>
          </SubSection>
        </Section>

        {/* ── Deployments ── */}
        <Section id="deployments" title="Deployments">
          <p className="doc-p">
            Each app has multiple <strong>Deployments</strong> — isolated channels with their own release history and deployment key.
            FastPush creates <strong>Production</strong> and <strong>Staging</strong> automatically.
          </p>

          <Table
            headers={['Deployment', 'Use case']}
            rows={[
              ['Production', 'Live users — be careful here'],
              ['Staging', 'Internal QA / beta testing'],
              ['Development', 'Local dev testing (create manually)'],
            ]}
          />

          <Note type="tip">
            Use Staging to test a release internally before promoting to Production. Give your testers the Staging deployment key.
          </Note>

          <SubSection title="Get your deployment key">
            <p className="doc-p">
              Go to <strong>Dashboard → Your App → Deployments</strong>, click on a deployment card to see its key.
              Copy it into your <code className="doc-inline-code">FastPush.configure()</code> call.
            </p>
          </SubSection>

          <SubSection title="Push to a specific deployment">
            <Code>{`
# Push to Staging
fastpush release --app MyApp --deployment Staging --target-version "1.0.x"

# Push to Production
fastpush release --app MyApp --deployment Production --target-version "1.0.x"
            `}</Code>
          </SubSection>

          <SubSection title="Create a custom deployment">
            <p className="doc-p">
              In the dashboard, go to <strong>Deployments</strong> and click <strong>+ Deployment</strong>.
              Or via API: <code className="doc-inline-code">POST /api/apps/:appId/deployments</code>.
            </p>
          </SubSection>
        </Section>

        {/* ── Rollout & Rollback ── */}
        <Section id="rollout" title="Rollout & Rollback">
          <SubSection title="Gradual rollout">
            <p className="doc-p">
              Instead of releasing to all users at once, start with a small percentage and expand only if metrics look healthy.
            </p>
            <Code>{`
# Step 1 — Push to 10% of users
fastpush release --app MyApp --target-version "1.0.x" --rollout 10

# Step 2 — Monitor metrics (downloads, installs, failures)
fastpush metrics --app MyApp

# Step 3 — Expand if healthy
fastpush promote --app MyApp --version 5 --rollout 50
fastpush promote --app MyApp --version 5 --rollout 100
            `}</Code>
            <Note type="tip">
              Rollout is <strong>deterministic</strong> — the same device always gets the same result for a given release,
              so users don't switch in/out randomly between app launches.
            </Note>
          </SubSection>

          <SubSection title="Rollback">
            <p className="doc-p">If a release has a bug, roll it back instantly. The previous active release becomes active again.</p>
            <Code>{`fastpush rollback --app MyApp`}</Code>
            <p className="doc-p">Or from the dashboard: <strong>Deployment → release row → Rollback</strong>.</p>
          </SubSection>

          <SubSection title="Auto-rollback on crash">
            <p className="doc-p">
              If you set up the crash handler in <code className="doc-inline-code">MainApplication.kt</code>, FastPush will
              automatically roll back after <strong>3 consecutive crashes</strong> caused by the downloaded bundle.
            </p>
            <Note type="warning">Auto-rollback only works for JS bundle updates, not APK updates.</Note>
          </SubSection>

          <SubSection title="Disable a release (without rollback)">
            <p className="doc-p">To stop serving a release without rolling back:</p>
            <p className="doc-p">Dashboard → Deployment → release row → <strong>Disable</strong>.</p>
            <p className="doc-p">Disabled releases are not served to new devices but do not affect devices that already installed them.</p>
          </SubSection>
        </Section>

        {/* ── Team & Roles ── */}
        <Section id="team" title="Team & Roles">
          <p className="doc-p">
            Invite team members to collaborate on an app. Each member has a role that controls what they can do.
          </p>

          <Table
            headers={['Role', 'Can release', 'Can manage team', 'Can delete app']}
            rows={[
              ['Owner', '✅', '✅', '✅'],
              ['Collaborator', '✅', '❌', '❌'],
              ['Viewer', '❌ (read only)', '❌', '❌'],
            ]}
          />

          <SubSection title="Invite a member">
            <p className="doc-p">Go to <strong>App → Team → Invite member</strong>, enter email and choose role.</p>
            <p className="doc-p">An invite link will be generated. Share it with the person. They click the link and join automatically after logging in.</p>
            <Note type="info">Email sending is not configured by default — copy the invite link and send it manually.</Note>
          </SubSection>

          <SubSection title="Change role or remove member">
            <p className="doc-p">Only <strong>Owners</strong> can change roles or remove members.</p>
            <p className="doc-p">Go to <strong>App → Team</strong>, use the role dropdown or the Remove button next to each member.</p>
          </SubSection>
        </Section>

        {/* ── APK Updates ── */}
        <Section id="apk" title="APK Updates (Full Native)">
          <p className="doc-p">
            For major updates that include native code changes (new libraries, permissions, etc.),
            you can distribute a full APK through FastPush without going to the Play Store.
          </p>

          <Note type="warning">
            APK distribution requires <code className="doc-inline-code">REQUEST_INSTALL_PACKAGES</code> permission and
            a FileProvider configured in <code className="doc-inline-code">AndroidManifest.xml</code>. Android will show a
            system prompt asking the user to confirm installation.
          </Note>

          <SubSection title="Push an APK">
            <Code>{`
fastpush release \\
  --app MyApp \\
  --target-version "1.0.x" \\
  --type apk \\
  --file ./android/app/build/outputs/apk/release/app-release.apk \\
  --description "Major update with new features"
            `}</Code>
          </SubSection>

          <SubSection title="Handle APK update in JS">
            <Code lang="javascript">{`
const update = await FastPush.checkForUpdate();

if (update?.type === 'apk') {
  Alert.alert(
    'Major Update Available',
    update.description || 'A new version of the app is available.',
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Download & Install',
        onPress: () => FastPush.downloadAndApply(update, setProgress),
      },
    ]
  );
}
            `}</Code>
          </SubSection>

          <SubSection title="Build a release APK">
            <Code>{`
cd android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
            `}</Code>
          </SubSection>
        </Section>

        <div className="doc-footer">
          <div className="doc-footer-text">
            FastPush — built for teams that ship fast.
          </div>
        </div>
      </div>
    </div>
  );
}
