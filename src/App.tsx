import { useEffect, useState } from 'react'
import './App.css'
import { FileInput } from './components/FileInput'
import { xmlListToJson, xmlToJson } from './utils'
import * as XLSX from 'xlsx';

const selectGoods = 'ESADout_CUGoods'
const selectDTSGoods = 'DTSout_CUGoodsCustomsCost'
const selectCustomPaymentsFromGood = 'ESADout_CUCustomsPaymentCalculation'

const fieldNamesDT = {
  goodNumber: 'catESAD_cu:GoodsNumeric',
  tnvedNumber: 'catESAD_cu:GoodsTNVEDCode',
  invoiceCost: 'catESAD_cu:InvoicedCost',
  paymentCode: 'catESAD_cu:PaymentModeCode',
  paymentAmount: 'catESAD_cu:PaymentAmount',
  description: 'catESAD_cu:GoodsDescription'
}

const fieldNamesDTS = {
  Доставка: 'cat_EDTS_cu:BorderTransportCharges',
  ['Cтрахование товаров']: 'cat_EDTS_cu:InsuranceCharges',
  ['Платежи ИС']: 'cat_EDTS_cu:IntellectualPropertyPayment',
  ['Погрузка']: 'cat_EDTS_cu:LoadCharges',
  ['Упаковка']: 'cat_EDTS_cu:PackageExpenses',
  ['Доход агента']: 'cat_EDTS_cu:SellerIncome',
  ['Хранение']: 'cat_EDTS_cu:StoreCost',
}

const fieldNamesDTSIterate = Object.entries(fieldNamesDTS)

function App() {
  const [file, setFile] = useState<File>()
  const [wb, setWb] = useState<XLSX.WorkBook>()

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
          const readXml = e.target?.result as string | undefined;
          if(readXml) {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(readXml, "application/xml");
              const goodsOut =  xmlDoc?.getElementsByTagName(selectGoods)
              const dtsoutGoods =  xmlDoc?.getElementsByTagName(selectDTSGoods)

              const goodsData: Record<string, any> = {}

              let customsDutyPayment = 0

              for (const product of goodsOut) {
                const customsPayments = product.getElementsByTagName(selectCustomPaymentsFromGood)
                const customsPaymentsParsed = customsPayments && xmlListToJson(customsPayments)
                const productParsed = xmlToJson(product);
                const no = productParsed[fieldNamesDT.goodNumber] as string

                goodsData[no] = {
                  ['Номер по ДТ']: no,
                  ['ТН ВЭД']: productParsed[fieldNamesDT.tnvedNumber],
                  ['Cтоимость по инвойсу']: productParsed[fieldNamesDT.invoiceCost],
                  ['Описание по ДТ']: productParsed.description
                };

                customsPaymentsParsed?.forEach(payment => {
                  const paymentCode = payment[fieldNamesDT.paymentCode] as string
                  const paymentAmount = payment[fieldNamesDT.paymentAmount] as string
                  if (paymentCode === '1010') {
                    customsDutyPayment = parseFloat(paymentAmount);
                  } else if (paymentCode && paymentAmount) {
                    goodsData[no][paymentCode] = parseFloat(paymentAmount)
                  }
                })
              }

              const customsDutyPaymentByProduct = Math.min(customsDutyPayment / dtsoutGoods.length, 0);

              for (const dtsProduct of dtsoutGoods) {
                const dtsProductParsed = xmlToJson(dtsProduct)
                const additional = dtsProduct.getElementsByTagName('cat_EDTS_cu:Method1AdditionalSum')?.[0]
                const additionalPased = additional && xmlToJson(additional);
                const no = dtsProductParsed?.GTDGoodsNumber as string

                if (no && no in goodsData && additionalPased) {
                  goodsData[no]['Сборы за таможенное оформление'] = customsDutyPaymentByProduct
                  goodsData[no]['Доставка до'] = additionalPased['cat_EDTS_cu:BorderPlace']
                  fieldNamesDTSIterate.forEach(([key, originalKey]) => {
                    if (additionalPased[originalKey]) {
                      goodsData[no][key] = parseFloat(additionalPased[originalKey]) || additionalPased[originalKey]
                    }
                  })
                }
              }

              const workbook = XLSX.utils.book_new();
              const worksheet = XLSX.utils.json_to_sheet(Object.values(goodsData), { header: ['Номер по ДТ', 'ТН ВЭД', 'Cтоимость по инвойсу', 'Описание по ДТ', 'Сборы за таможенное оформление']})
              XLSX.utils.book_append_sheet(workbook, worksheet, "Goods");
              setWb(workbook)
          }
      }
      reader.readAsText(file);
    }
  }, [file])


  const getTable = () => {
    if (wb) {
      const ws = wb.Sheets[wb.SheetNames?.[0]];

      return XLSX.utils.sheet_to_html(ws);
    }
    return ''
  }

  return (
    <>
      <div>
        <FileInput onChange={setFile} />
        <div>
          {wb && (
            <>
            <div dangerouslySetInnerHTML={{ __html: getTable() }}/>
            <button type="button" className="mt-4 focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800" 
              onClick={() => {
                XLSX.writeFile(wb, "Goods.xlsx", { compression: true });
              }}>
                Скачать XLSX
              </button>
              </>
          )}
        </div>
      </div>
    </>
  )
}

export default App
