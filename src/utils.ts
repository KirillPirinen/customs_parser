import * as XLSX from 'xlsx';

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

export const loadPIExcelFile = (file: File): Array<Array<any>> => {
  // @ts-expect-error
  return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const data = e.target?.result as ArrayBuffer
          if (data) {
            const wb = XLSX.read(data, { type: 'buffer' })
            const ws = wb.Sheets[wb.SheetNames?.[0]];
            resolve(XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, skipHidden: true }))
          } else {
            reject()
          }
      }
      reader.readAsArrayBuffer(file)
  })
}
