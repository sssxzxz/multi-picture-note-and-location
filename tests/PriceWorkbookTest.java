package cn.zx.photomarker;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
public class PriceWorkbookTest {
 static int checks=0;
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);checks++;}
 static File fixture(String sheet)throws Exception{
  File f=File.createTempFile("price-test-",".xlsx");f.deleteOnExit();try(ZipOutputStream z=new ZipOutputStream(new FileOutputStream(f))){
   Map<String,String> entries=new LinkedHashMap<>();entries.put("xl/workbook.xml","<workbook xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='价格' r:id='r1'/></sheets></workbook>");entries.put("xl/_rels/workbook.xml.rels","<Relationships><Relationship Id='r1' Target='worksheets/sheet1.xml'/></Relationships>");entries.put("xl/sharedStrings.xml","<sst><si><t>Ab12</t></si><si><r><t>型号</t></r><r><t>文本</t></r></si></sst>");entries.put("xl/styles.xml","<styleSheet><numFmts><numFmt numFmtId='164' formatCode='00000'/></numFmts><cellXfs><xf numFmtId='0'/><xf numFmtId='164'/><xf numFmtId='14'/></cellXfs></styleSheet>");entries.put("xl/worksheets/sheet1.xml",sheet);
   for(Map.Entry<String,String> e:entries.entrySet()){z.putNextEntry(new ZipEntry(e.getKey()));z.write(e.getValue().getBytes(StandardCharsets.UTF_8));z.closeEntry();}
  }return f;
 }
 public static void main(String[] args)throws Exception{
  List<PriceWorkbook.Sheet> sheets=PriceWorkbook.read(fixture("<worksheet><sheetData><row r='1'><c r='A1' t='s'><v>1</v></c><c r='B1' t='inlineStr'><is><t>价格</t></is></c></row><row r='3'><c r='A3' t='s'><v>0</v></c><c r='B3'><v>12.500</v></c><c r='D3' s='1'><v>12.0</v></c><c r='E3'><f>1+2</f><v>3</v></c><c r='F3' t='e'><v>#N/A</v></c><c r='G3' s='2'><v>45000</v></c><c r='H3'><v>0</v></c></row></sheetData></worksheet>"));
  PriceWorkbook.Sheet s=sheets.get(0);check(s.name.equals("价格"),"sheet name");check(s.rows.get(0).get(0).equals("型号文本"),"rich shared string");check(s.rows.get(0).get(1).equals("价格"),"inline text");check(s.rows.get(1).isEmpty(),"sparse row");List<String> r=s.rows.get(2);check(r.get(0).equals("Ab12"),"case preserved");check(r.get(1).equals("12.5"),"numeric canonical");check(r.get(2).isEmpty(),"sparse column");check(r.get(3).equals("00012"),"formatted leading zeros");check(r.get(4).isEmpty()&&r.get(5).isEmpty()&&r.get(6).isEmpty(),"formula error date skipped");check(r.get(7).equals("0"),"zero valid");
  for(String bad:new String[]{"<!DOCTYPE worksheet [<!ENTITY x SYSTEM 'file:///test'>]><worksheet>&x;</worksheet>","<worksheet><row r='50001'/></worksheet>","<worksheet><row r='1'><c r='A1' t='s'><v>99</v></c></row></worksheet>"}){boolean failed=false;try{PriceWorkbook.read(fixture(bad));}catch(Exception e){failed=true;}check(failed,"malformed or unsafe workbook rejected");}
  if(args.length>0){List<PriceWorkbook.Sheet> sample=PriceWorkbook.read(new File(args[0]));check(sample.size()==1,"sample sheet count");check(sample.get(0).rows.get(1).get(0).equals("242"),"sample numeric model normalized");check(sample.get(0).rows.get(1).get(1).equals("6"),"sample price parsed");check(sample.get(0).rows.get(3).get(2).equals("6.5"),"sample alternative price preserved");System.out.println("Sample parsed: "+sample.get(0).rows.size()+" rows");}
  System.out.println("OK: "+checks+" XLSX reader checks");
 }
}
