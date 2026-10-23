const paths = {
  stays: process.env.REACT_APP_BDS_STAYS_CSS,
  owner: process.env.REACT_APP_BDS_OWNER_CSS,
};
const pending = new Map();

export function loadRouteStyles(group) {
  const path = paths[group];
  // Other build systems still include the source CSS imports normally.
  if (!path) return Promise.resolve();
  if (!pending.has(group)) {
    pending.set(group, new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL(path, import.meta.url).href;
      link.dataset.bdsRouteStyle = group;
      link.onload = resolve;
      link.onerror = () => {
        pending.delete(group);
        link.remove();
        reject(new Error(`Unable to load ${group} styles`));
      };
      document.head.appendChild(link);
    }));
  }
  return pending.get(group);
}
