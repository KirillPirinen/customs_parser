export function xmlToJson(xml: Element) {
  const json: Record<string, unknown> = {};
  
  // Iterate through child nodes
  for (let j = 0; j < xml.children.length; j++) {
      const child = xml.children[j];
      json[child.tagName] = child.textContent; // Use tag name as key and text content as value
  }

  return json;
}


export function xmlListToJson(xml: HTMLCollection) {
  const json = [];
  
  for (let i = 0; i < xml.length; i++) {
      const item = xml[i];
      json.push(xmlToJson(item));
  }

  return json;
}
