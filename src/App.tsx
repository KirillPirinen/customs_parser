import { useEffect, useState } from 'react'
import './App.css'
import { FileInput } from './components/FileInput'
import { loadPIExcelFile, xmlListToJson, xmlToJson } from './utils'
import * as XLSX from 'xlsx';

const selectGoods = 'ESADout_CUGoods'
const selectDTSGoods = 'DTSout_CUGoodsCustomsCost'
const selectCustomPaymentsFromGood = 'ESADout_CUCustomsPaymentCalculation'
const selectGroupInfo = 'catESAD_cu:GoodsGroupInformation'
const selectGroupInfoQty = 'catESAD_cu:GoodsGroupQuantity' // format 79ШТ796'
const selectGroupInfoModel = 'catESAD_cu:GoodsModel'
const selectGroupInfoWeight = 'catESAD_cu:ArticleWeight'
const selectNetWeight = 'catESAD_cu:NetWeightQuantity'
const selectPositionWeight = 'catESAD_cu:ArticleWeight'

const fieldNamesDT = {
  goodNumber: 'catESAD_cu:GoodsNumeric',
  tnvedNumber: 'catESAD_cu:GoodsTNVEDCode',
  invoiceCost: 'catESAD_cu:InvoicedCost',
  paymentCode: 'catESAD_cu:PaymentModeCode',
  paymentAmount: 'catESAD_cu:PaymentAmount',
  description: 'catESAD_cu:GoodsDescription'
}

const fieldNamesGroupInfo = {
  ['Модель']: selectGroupInfoModel,
  ['Производитель']: 'catESAD_cu:Manufacturer',
  ['Вес']: selectGroupInfoWeight,
}

const fieldNamesDTSBySum = {
  ['Cтрахование товаров']: 'cat_EDTS_cu:InsuranceCharges',
  ['Платежи ИС']: 'cat_EDTS_cu:IntellectualPropertyPayment',
  ['Доход агента']: 'cat_EDTS_cu:SellerIncome',
}

const fieldNamesDTSByWeight = {
  Доставка: 'cat_EDTS_cu:BorderTransportCharges',
  ['Погрузка']: 'cat_EDTS_cu:LoadCharges',
  ['Упаковка']: 'cat_EDTS_cu:PackageExpenses',
  ['Хранение']: 'cat_EDTS_cu:StoreCost',
}

const fieldNamesGroupInfoIterate = Object.entries(fieldNamesGroupInfo)
const fieldNamesBySumDTSIterate = Object.entries(fieldNamesDTSBySum)
const fieldNamesByWeightDTSIterate = Object.entries(fieldNamesDTSByWeight)

function App() {
  const [meta, setMeta] = useState<{ count: number, dict: Record<string, { total: number, billNo: number, id: string }> }>()
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
              const bySumRatios: Record<string, number> = {}
              const byWeightRatios: Record<string, number> = {}
              const totalNetWeight = 0
              let totalPositions = 0

              const innerGroups: Record<string, Array<Record<string, any>>> = {}

              for (const product of goodsOut) {
                const groups = product.getElementsByTagName(selectGroupInfo)
                const customsPayments = product.getElementsByTagName(selectCustomPaymentsFromGood)
                const customsPaymentsParsed = customsPayments && xmlListToJson(customsPayments)
                const groupsParsed = groups && xmlListToJson(groups)
                const productParsed = xmlToJson(product);
                const no = productParsed[fieldNamesDT.goodNumber] as string
                const productWeight = productParsed[selectNetWeight] ? parseFloat(productParsed[selectNetWeight] as string) : undefined

                innerGroups[no] = []

                const payments: Record<string, number> = {}

                customsPaymentsParsed?.forEach(payment => {
                  const paymentCode = payment[fieldNamesDT.paymentCode] as string
                  const paymentAmount = payment[fieldNamesDT.paymentAmount] as string
                  if (paymentCode === '1010') {
                    customsDutyPayment = parseFloat(paymentAmount);
                  } else if (paymentCode && paymentAmount) {
                    payments[paymentCode] = parseFloat(paymentAmount)
                  }
                })

                const productInvoiceCost = parseFloat(productParsed['catESAD_cu:InvoicedCost'] as string)

                groupsParsed.forEach((group, i) => {
                  totalPositions += 1

                  const qty = (group[selectGroupInfoQty] as string)?.split('ШТ')?.[0]
                  const id = group[selectGroupInfoModel] as string
                  const metaData = id && meta?.dict[id]
                  const _innerId = `${no}.${i + 1}`
                  const invoiceCost = metaData ? metaData.total : '-'
                  const positionWeight = group[selectPositionWeight] ? parseFloat(group[selectPositionWeight] as string) : undefined

                  goodsData[_innerId] = {
                    ['Номер по ДТ']: no,
                    ['ТН ВЭД']: productParsed[fieldNamesDT.tnvedNumber],
                    ['Количество']: qty ? parseInt(qty) : 0,
                    ['Номер счета']: metaData ? metaData.billNo : '-',
                    ['Cумма по инвойсу']: metaData ? invoiceCost : '-',
                    ...fieldNamesGroupInfoIterate.reduce<Record<string, any>>((acc, [key, origKey]) => {
                      acc[key] = group[origKey] || '-'
                      return acc
                    }, {})
                  };

                  if (productWeight && positionWeight) {
                    byWeightRatios[_innerId] = positionWeight / productWeight
                  }

                  if (metaData && typeof invoiceCost === 'number') {
                    const ratio = invoiceCost / productInvoiceCost
                    bySumRatios[_innerId] = ratio
                    Object.keys(payments).forEach(paymentCode => {
                      goodsData[_innerId][paymentCode] = payments[paymentCode] * ratio
                    })
                  }

                  if (metaData && typeof invoiceCost === 'number') {
                    const ratio = invoiceCost / productInvoiceCost
                    bySumRatios[_innerId] = ratio
                    Object.keys(payments).forEach(paymentCode => {
                      goodsData[_innerId][paymentCode] = payments[paymentCode] * ratio
                    })
                  }

                  innerGroups[no].push(goodsData[_innerId])
                })
              }

              const customsDutyPaymentByPosition = Math.max(customsDutyPayment / totalPositions, 0);

              for (const dtsProduct of dtsoutGoods) {
                const dtsProductParsed = xmlToJson(dtsProduct)
                const additional = dtsProduct.getElementsByTagName('cat_EDTS_cu:Method1AdditionalSum')?.[0]
                const additionalPased = additional && xmlToJson(additional);
                const no = dtsProductParsed?.GTDGoodsNumber as string
                const positions = innerGroups[no]

                if (positions?.length && additionalPased) {
                  positions.forEach((position, i) => {
                    const _innerId = `${no}.${i + 1}`
                    position['1010'] = customsDutyPaymentByPosition
                    position['Доставка до'] = additionalPased['cat_EDTS_cu:BorderPlace']
                    
                    fieldNamesBySumDTSIterate.forEach(([key, originalKey]) => {
                      if (additionalPased[originalKey]) {
                        const ratio = bySumRatios[_innerId]
                        if (ratio) {
                          // @ts-expect-error
                          const dtsSumPerItem = parseFloat(additionalPased[originalKey])
                          position[key] = dtsSumPerItem * ratio
                        }
                      }
                    })
                    
                    fieldNamesByWeightDTSIterate.forEach(([key, originalKey]) => {
                      if (additionalPased[originalKey]) {
                        const ratio = byWeightRatios[_innerId]
                        if (ratio) {
                          // @ts-expect-error
                          const dtsSumPerItem = parseFloat(additionalPased[originalKey])
                          position[key] = dtsSumPerItem * ratio
                        }
                      }
                    })
                  })
                }
              }

              const workbook = XLSX.utils.book_new();
              const worksheet = XLSX.utils.json_to_sheet(Object.values(goodsData), { header: ['Номер по ДТ', 'ТН ВЭД', 'Количество', 'Номер счета', 'Cумма по инвойсу', 'Модель', 'Производитель', 'Вес', 'Доставка до', '1010', '5010', '2010']})
              XLSX.utils.book_append_sheet(workbook, worksheet, "Goods");
              setWb(workbook)
          }
      }
      reader.readAsText(file);
    }
  }, [file, meta])


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
        <FileInput 
          onChange={async (file) => {
            const jsonSheet = await loadPIExcelFile(file)
            let count = 0
            const dict = jsonSheet.reduce((acc, row) => {
              if (Array.isArray(row)) {
                const rawId = row[1]
                const id: string = rawId ? rawId.toString().trim() : undefined
                const total = row[7]
                const billNo = row[8]
                if (id && typeof total ==='number' && billNo) {
                  count += 1
                  acc[id] = { id, total, billNo }
                }
              }
              return acc
            }, {} as NonNullable<typeof meta>['dict'])
            setMeta({ dict, count })
          }}
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          description='Инвойс с товарами типо PI.....'
        />
        <FileInput onChange={setFile} accept="application/xml" description='XML Декларации на товары с ДТС' />
        <div>
          {wb && (
            <>
              <button type="button" className="my-4 focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800" 
                onClick={() => {
                  XLSX.writeFile(wb, "Goods.xlsx", { compression: true });
                }}>
                Скачать XLSX
              </button>
              <div dangerouslySetInnerHTML={{ __html: getTable() }} className='mt-4' />
              </>
          )}
        </div>
      </div>
    </>
  )
}

export default App
