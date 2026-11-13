/**
 * Loaded before the app's own code in end-to-end tests (electron -r, see app.spec.ts). It replaces ClickUp
 * with small fake pages, so tests never depend on the internet or a ClickUp account, and it
 * records Windows notifications and links sent to the browser instead of showing them.
 */
import { app, Notification, session, shell } from 'electron';

globalThis.__e2e = { notifications: [], external: [] };

Notification.isSupported = () => true;
Notification.prototype.show = function show() {
  globalThis.__e2e.notifications.push(this);
};
shell.openExternal = async (url) => {
  globalThis.__e2e.external.push(url);
};

const page = (name) => `<!doctype html>
<title>${name} | ClickUp</title>
<h1>${name}</h1>
<a id="task" href="https://app.clickup.com/t/42" target="_blank">Task 42</a>
<a id="external" href="https://example.com/" target="_blank">Example</a>
<script>
  window.notify = (title) => {
    const notification = new Notification(title, { body: 'From ${name}' });
    notification.onclick = () => (document.title = 'Clicked | ClickUp');
  };
</script>`;

app.whenReady().then(() => {
  session.fromPartition('persist:clickup').protocol.handle('https', (request) => {
    const { pathname } = new URL(request.url);
    const task = /^\/t\/(\w+)/.exec(pathname);
    const name = task ? `Task ${task[1]}` : 'Home';
    return new Response(page(name), { headers: { 'content-type': 'text/html' } });
  });
});
