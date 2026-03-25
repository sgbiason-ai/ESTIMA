export const flattenItems = (nodes) => {
  const items = [];
  const traverse = (list) => {
    list.forEach(n => {
      if (n.type === 'item') items.push(n);
      if (n.children) traverse(n.children);
    });
  };
  traverse(nodes || []);
  return items;
};

export const getChapters = (nodes) => {
  return (nodes || []).filter(n => n.type === 'chapter');
};
