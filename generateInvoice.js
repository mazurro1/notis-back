const fs = require("fs");
const PDFDocument = require("pdfkit");

function createInvoice(invoice, numberInvoice = "1", actualDateInvoice) {
  let doc = new PDFDocument({ size: "A4", margin: 50 });
  const actualDate = actualDateInvoice;
  const actualDay = actualDate.getDate();
  const actualMonth = actualDate.getMonth() + 1;
  const actualYear = actualDate.getFullYear();

  generateHeader(doc, actualDay, actualMonth, actualYear);
  generateCustomerInformation(doc, invoice, 170, "SPRZEDAWCA", "dealer");
  generateCustomerInformation(doc, invoice, 300, "NABYWCA", "shipping");
  generateNumberInvoice(doc, numberInvoice, actualDay, actualMonth, actualYear);
  generateInvoiceTable(doc, invoice);
  generateFooter(doc);

  doc.end();
  return doc;
}

function generateHeader(doc, actualDay, actualMonth, actualYear) {
  doc
    .image("./src/logo.png", 50, 45, { width: 200 })
    .fillColor("#444444")
    .fontSize(10)
    .text(
      `Warszawa, ${actualDay < 10 ? `0${actualDay}` : actualDay}.${
        actualMonth < 10 ? `0${actualMonth}` : actualMonth
      }.${actualYear}`,
      200,
      50,
      {
        align: "right",
      }
    )
    .moveDown();
}

function generateCustomerInformation(
  doc,
  invoice,
  customerInformationTop = 150,
  title,
  field
) {
  doc
    .fillColor("#444444")
    .fontSize(14)
    .text(title, 50, customerInformationTop - 30);

  generateHr(doc, customerInformationTop - 10);

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(invoice[field].name, 50, customerInformationTop)
    .font("Helvetica")
    .text(
      `${invoice[field].code}  ${invoice[field].city}`,
      50,
      customerInformationTop + 15
    )
    .text(`${invoice[field].address}`, 50, customerInformationTop + 30)
    .text(`NIP: ${invoice[field].nip}`, 50, customerInformationTop + 45)
    .moveDown();

  generateHr(doc, customerInformationTop + 62);
}

function generateNumberInvoice(
  doc,
  numberInvoice,
  actualDay,
  actualMonth,
  actualYear
) {
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(
      `Faktura VAT Nr: ${numberInvoice}/${actualDay}/${actualMonth}/${actualYear}`,
      50,
      400,
      {
        align: "center",
      }
    )
    .moveDown();
}

function generateInvoiceTable(doc, invoice) {
  let i;
  const invoiceTableTop = 450;

  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    invoiceTableTop,
    "Lp",
    "Rodzaj towaru",
    "Ilosc",
    "Jm",
    "Wartosc netto [zl]",
    "VAT [%]",
    "Wartosc VAT [zl]",
    "Wartosc BRUTTO [zl]"
  );
  generateHr(doc, invoiceTableTop + 20);
  doc.font("Helvetica");

  let allCountPrice = 0;

  for (i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    const position = invoiceTableTop + (i + 1) * 30;
    allCountPrice = allCountPrice + item.price * item.count;
    generateTableRow(
      doc,
      position,
      i + 1 + ".",
      item.name,
      item.count,
      "szt",
      (item.count * item.price * 0.77).toFixed(2),
      "23",
      (item.count * item.price * 0.23).toFixed(2),
      (item.count * item.price).toFixed(2)
    );

    generateHr(doc, position + 20);
  }

  const subtotalPosition = invoiceTableTop + (i + 1) * 30;
  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    subtotalPosition,
    "",
    "",
    "Razem",
    "",
    (allCountPrice * 0.77).toFixed(2),
    "23",
    (allCountPrice * 0.23).toFixed(2),
    allCountPrice.toFixed(2),
    14
  );
}

function generateFooter(doc) {
  doc
    .font("Helvetica")
    .fontSize(10)
    .text("Wystawil: HUBERT MAZUR", 50, 750, { align: "right" })
    .fontSize(10)
    .text(
      "Imie, nazwisko i podpis osoby upowaznionej do odebrania dokumentu",
      50,
      750,
      { align: "center", width: 200 }
    );
}

function generateTableRow(
  doc,
  y,
  lp,
  description,
  count,
  jm,
  netto,
  vat,
  countVat,
  brutto,
  sizeFont = 8
) {
  doc
    .fontSize(sizeFont)
    .text(lp, 50, y)
    .text(description, 70, y)
    .text(count, 180, y)
    .text(jm, 215, y)
    .text(netto, 245, y)
    .text(vat, 330, y)
    .text(countVat, 380, y)
    .text(brutto, 450, y, { align: "right" });
}

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

module.exports = {
  createInvoice,
};
