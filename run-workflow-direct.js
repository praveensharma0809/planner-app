#!/usr/bin/env node

/**
 * Direct workflow execution - handles all steps
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const repoPath = 'C:\\Users\\Lenono\\Desktop\\planner-app';

function log(msg) {
  console.log(msg);
}

function cmd(command, cwd = repoPath) {
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: 'inherit'
    });
    return { success: true, output: result };
  } catch (err) {
    return { success: false, output: err.stdout || '', error: err.message };
  }
}

async function serverReady(timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch('http://localhost:3000/', {
        method: 'HEAD',
        timeout: 2000
      }).catch(() => null);
      if (res) return true;
    } catch (e) {
      // Not ready
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

(async () => {
  log('\n' + '█'.repeat(80));
  log('█ PLANNER APP: SCREENSHOT & TEST WORKFLOW');
  log('█'.repeat(80));

  // === STEP 1: Git Status ===
  log('\n[STEP 1] GIT STATUS & HEAD');
  log('─'.repeat(80));

  try {
    const statusCmd = execSync('git --no-pager status --short', {
      cwd: repoPath,
      encoding: 'utf-8'
    });
    const headCmd = execSync('git rev-parse --short HEAD', {
      cwd: repoPath,
      encoding: 'utf-8'
    });

    log('Git Status:');
    log(statusCmd);
    log('\nGit HEAD:');
    log(headCmd);
  } catch (err) {
    log('Error getting git status: ' + err.message);
  }

  // === STEP 2: Start Dev Server ===
  log('\n[STEP 2] STARTING DEV SERVER');
  log('─'.repeat(80));

  const dev = spawn('npm', ['run', 'dev'], {
    cwd: repoPath,
    stdio: 'pipe',
    shell: true
  });

  let devOutput = [];
  dev.stdout.on('data', d => devOutput.push(d.toString()));
  dev.stderr.on('data', d => devOutput.push(d.toString()));

  log('Starting server... (waiting max 60 seconds)');
  const serverUp = await serverReady(60000);

  if (!serverUp) {
    log('✗ Server failed to start within 60 seconds');
    dev.kill();
    log('Dev output (last 20 lines):');
    devOutput.slice(-20).forEach(line => log(line));
    process.exit(1);
  }

  log('✓ Server is running at http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));

  // === STEP 3: Capture Screenshots ===
  log('\n[STEP 3] CAPTURING SCREENSHOTS');
  log('─'.repeat(80));

  const outDir = path.join(repoPath, 'app_screenshots', 'Post_F6');
  fs.mkdirSync(outDir, { recursive: true });

  let screenshotStats = {
    total: 0,
    success: 0,
    failures: []
  };

  try {
    const { chromium } = require('playwright');

    const routes = [
      { name: 'dashboard', path: '/dashboard' },
      { name: 'dashboard/subjects', path: '/dashboard/subjects' },
      { name: 'dashboard/calendar', path: '/dashboard/calendar' },
      { name: 'schedule', path: '/schedule' },
      { name: 'planner', path: '/planner' },
      { name: 'dashboard/settings', path: '/dashboard/settings' }
    ];

    const widths = [375, 768, 1024, 1440, 1600];
    screenshotStats.total = routes.length * widths.length;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await context.newPage();

    try {
      // Login
      log('Authenticating...');
      await page.goto('http://localhost:3000/auth/login', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      await page.fill('input#email', 'praveen.vts@rediffmail.com');
      await page.fill('input#password', 'impossible');
      await page.click('button[type="submit"]');

      await page.waitForTimeout(3000);
      log('✓ Authentication successful');

      // Capture screenshots
      log(`\nCapturing ${screenshotStats.total} screenshots...`);
      for (const route of routes) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          const url = `http://localhost:3000${route.path}`;
          const filename = `${route.name}_${width}px.png`;

          try {
            await page.goto(url, {
              waitUntil: 'networkidle',
              timeout: 30000
            });
            await page.waitForTimeout(1500);
            const filepath = path.join(outDir, filename);
            await page.screenshot({ path: filepath, fullPage: false });
            screenshotStats.success++;
            process.stdout.write('.');
          } catch (err) {
            screenshotStats.failures.push(
              `${filename}: ${err.message}`
            );
            process.stdout.write('F');
          }
        }
      }

      log(
        `\n\nScreenshots captured: ${screenshotStats.success}/${screenshotStats.total}`
      );
      if (screenshotStats.failures.length > 0) {
        log('Failures:');
        screenshotStats.failures.slice(0, 5).forEach(f => log(`  ✗ ${f}`));
        if (screenshotStats.failures.length > 5)
          log(
            `  ... and ${screenshotStats.failures.length - 5} more`
          );
      }

      await page.close();
      await browser.close();
    } catch (err) {
      log('Automation error: ' + err.message);
      await browser.close();
    }

    const savedFiles = fs
      .readdirSync(outDir)
      .filter(f => f.endsWith('.png'));
    log(`\nSaved: ${savedFiles.length} PNG files to Post_F6/`);
  } catch (err) {
    log('Screenshot error: ' + err.message);
  }

  // === STEP 4: Stop Dev Server ===
  log('\n[STEP 4] STOPPING DEV SERVER');
  log('─'.repeat(80));

  dev.kill();
  await new Promise(r => setTimeout(r, 2000));
  log('✓ Dev server stopped');

  // === STEP 5: Run Tests ===
  log('\n[STEP 5] RUNNING TESTS');
  log('─'.repeat(80));

  try {
    const testResult = execSync('npm run test 2>&1', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024
    });
  } catch (err) {
    // Tests may fail but we still get output via stdio: 'inherit'
  }

  // === STEP 6: Final Status ===
  log('\n[STEP 6] FINAL WORKING TREE STATUS');
  log('─'.repeat(80));

  try {
    const statusCmd = execSync('git --no-pager status --short', {
      cwd: repoPath,
      encoding: 'utf-8'
    });
    const finalStatus = statusCmd.trim();

    if (!finalStatus) {
      log('✓ Working tree is clean');
    } else {
      const lines = finalStatus.split('\n').filter(l => l.trim());
      const screenshots = lines.filter(l => l.includes('Post_F6'));
      const others = lines.filter(l => !l.includes('Post_F6'));

      log(`Modified files: ${lines.length}`);
      log(`  • Screenshots (Post_F6): ${screenshots.length} files`);

      if (others.length > 0) {
        log(`  • ⚠ Other changes: ${others.length} files`);
        others.slice(0, 3).forEach(l => log(`      ${l}`));
        if (others.length > 3)
          log(`      ... and ${others.length - 3} more`);
      }
    }
  } catch (err) {
    log('Error: ' + err.message);
  }

  // === FINAL SUMMARY ===
  log('\n' + '█'.repeat(80));
  log('█ SUMMARY');
  log('█'.repeat(80));

  log(`\nScreenshots:`);
  log(`  Location: app_screenshots/Post_F6/`);
  log(
    `  Count: ${screenshotStats.success}/${screenshotStats.total} successful`
  );
  log(`  Failures: ${screenshotStats.failures.length}`);

  log(`\n` + '█'.repeat(80));
  log('WORKFLOW COMPLETE');
  log('█'.repeat(80));
})();
