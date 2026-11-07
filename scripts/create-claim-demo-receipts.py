"""Create fictional purchase receipts for Hera's hackathon presentation assets."""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import json
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/claim-demo-kit'
PDF = ROOT / 'output/pdf/claim-presentation-receipts.pdf'
PDF.parent.mkdir(parents=True, exist_ok=True)
(OUT / 'receipts').mkdir(parents=True, exist_ok=True)
receipts = [
 dict(file='01-sofa-receipt', merchant='NORTHLINE HOME', tagline='Furniture & everyday living', date='2024-06-15', time='14:32', ref='NH-240615-0184', item='Green upholstered sofa', description='3-seat / woven green fabric', sku='SOF-GRN-310', price='1699.00', room='Living room', photo='01-living-room-before.jpg'),
 dict(file='02-coffee-table-receipt', merchant='NORTHLINE HOME', tagline='Furniture & everyday living', date='2024-08-03', time='11:18', ref='NH-240803-0291', item='Wood coffee table', description='Walnut finish / rectangular', sku='TBL-WAL-120', price='249.00', room='Living room', photo='01-living-room-before.jpg'),
 dict(file='03-monitor-receipt', merchant='RIVERBEND TECH', tagline='Computers, displays & accessories', date='2025-01-18', time='16:47', ref='RT-250118-0047', item='Computer monitor', description='27-inch / QHD / IPS display', sku='MON-QHD-270', price='349.99', room='Home office', photo='02-home-office-before.jpg'),
 dict(file='04-desktop-pc-receipt', merchant='RIVERBEND TECH', tagline='Computers, displays & accessories', date='2024-11-22', time='13:06', ref='RT-241122-0138', item='Desktop computer tower', description='Gaming PC / RGB / black case', sku='PC-GAME-RTX', price='1899.00', room='Home office', photo='02-home-office-before.jpg'),
]
W,H=288,480
c=canvas.Canvas(str(PDF), pagesize=(W,H))
c.setTitle('Purchase receipts - presentation props')
c.setAuthor('Hera presentation kit')
for r in receipts:
    amount=Decimal(r['price'])
    tax=(amount*Decimal('.13')).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    total=amount+tax
    r.update(purchasePrice=float(amount), tax=float(tax), total=float(total), currency='CAD', fictional=True)
    left,right=23,W-23
    c.setFillColorRGB(.99,.985,.97);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColorRGB(.12,.12,.12)
    c.setFont('Courier-Bold',20);c.drawCentredString(W/2,H-45,r['merchant'])
    c.setFont('Courier',8);c.drawCentredString(W/2,H-62,r['tagline'])
    c.drawCentredString(W/2,H-77,'Ottawa, Ontario / Canada')
    c.setFont('Courier-Bold',10);c.drawCentredString(W/2,H-102,'SALES RECEIPT')
    c.setFont('Courier',8)
    for y,text in [(H-122,f"Date: {r['date']}  {r['time']}"),(H-137,f"Receipt: {r['ref']}"),(H-152,'Currency: CAD - Canadian dollars')]:c.drawString(left,y,text)
    def rule(y):
        c.setLineWidth(.45);c.setDash(2,2);c.line(left,y,right,y);c.setDash()
    rule(H-165)
    c.setFont('Courier-Bold',10);c.drawString(left,H-185,r['item'])
    c.setFont('Courier',8);c.drawString(left,H-200,r['description'])
    c.drawString(left,H-214,'SKU: '+r['sku'])
    c.drawString(left,H-235,'QTY 1');c.drawRightString(right,H-235,f"CAD {amount:,.2f}")
    rule(H-247)
    for y,label,value in [(H-267,'Subtotal',amount),(H-284,'HST (13%)',tax)]:
        c.drawString(left,y,label);c.drawRightString(right,y,f'CAD {value:,.2f}')
    c.setFont('Courier-Bold',12);c.drawString(left,H-310,'TOTAL PAID');c.drawRightString(right,H-310,f'CAD {total:,.2f}')
    c.setFont('Courier',8);c.drawString(left,H-333,'Payment: Debit');c.drawRightString(right,H-333,'APPROVED')
    rule(H-347)
    barcode=code128.Code128(r['ref'],barWidth=.7,barHeight=28,humanReadable=False)
    barcode.drawOn(c,(W-barcode.width)/2,83)
    c.setFont('Courier',7);c.drawCentredString(W/2,70,r['ref'])
    c.drawCentredString(W/2,48,'Thank you for shopping with us.')
    c.drawCentredString(W/2,34,'Keep this receipt for your records.')
    c.showPage()
c.save()
(OUT / 'receipts-manifest.json').write_text(json.dumps(receipts,indent=2)+'\n')
print(PDF)
