package cn.zx.photomarker;

import java.io.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.zip.*;
import javax.xml.parsers.*;
import org.w3c.dom.*;
import org.xml.sax.InputSource;

/** Read-only XLSX extraction. Never executes formulas, links, macros or embedded content. */
public final class PriceWorkbook {
 public static final class Sheet {
  public final String name; public final List<List<String>> rows=new ArrayList<>();
  Sheet(String name){this.name=name;}
 }
 private final ZipFile zip; private long total=0; private int cells=0;
 private PriceWorkbook(ZipFile zip){this.zip=zip;}
 private Document xml(String path)throws Exception {
  ZipEntry entry=zip.getEntry(path);if(entry==null)throw new IOException("表格缺少必要内容："+path);
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=zip.getInputStream(entry)){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){total+=n;if(total>64L*1024*1024||bytes.size()+n>20*1024*1024)throw new IOException("表格过大，请拆分后导入");bytes.write(b,0,n);}}
  byte[] data=bytes.toByteArray();String check=new String(data,java.nio.charset.StandardCharsets.UTF_8).replace("\u0000","");
  if(check.contains("<!DOCTYPE")||check.contains("<!ENTITY"))throw new IOException("不支持含外部实体的表格");
  DocumentBuilderFactory factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);factory.setExpandEntityReferences(false);
  DocumentBuilder builder=factory.newDocumentBuilder();builder.setEntityResolver((publicId,systemId)->{throw new org.xml.sax.SAXException("External entities disabled");});
  return builder.parse(new ByteArrayInputStream(data));
 }
 private static List<Element> elements(Node node,String name){NodeList list=((node instanceof Document)?((Document)node).getElementsByTagNameNS("*",name):((Element)node).getElementsByTagNameNS("*",name));List<Element> out=new ArrayList<>();for(int i=0;i<list.getLength();i++)out.add((Element)list.item(i));return out;}
 private static String value(Element e,String name){List<Element> list=elements(e,name);return list.isEmpty()?"":list.get(0).getTextContent();}
 private static String text(Element e){StringBuilder s=new StringBuilder();for(Element t:elements(e,"t"))s.append(t.getTextContent());return s.toString();}
 private static int integer(String s,int fallback){return s.isEmpty()?fallback:Integer.parseInt(s);}
 public static List<Sheet> read(File file)throws Exception{
  if(file.length()>20*1024*1024)throw new IOException("表格超过 20 MB，请拆分后导入");
  try(ZipFile zip=new ZipFile(file)){return new PriceWorkbook(zip).read();}catch(ZipException e){throw new IOException("请选择未加密的 .xlsx 表格");}
 }
 private List<Sheet> read()throws Exception{
  Document book=xml("xl/workbook.xml"),rels=xml("xl/_rels/workbook.xml.rels");Map<String,String> paths=new HashMap<>();
  for(Element r:elements(rels,"Relationship")){if("External".equals(r.getAttribute("TargetMode")))continue;String target=r.getAttribute("Target");String path=target.startsWith("/")?target.substring(1):"xl/"+target;if(path.contains("..")||path.contains("\\"))throw new IOException("表格路径无效");paths.put(r.getAttribute("Id"),path);}
  List<String> shared=new ArrayList<>();if(zip.getEntry("xl/sharedStrings.xml")!=null)for(Element si:elements(xml("xl/sharedStrings.xml"),"si")){shared.add(text(si));if(shared.size()>250000)throw new IOException("表格文本过多");}
  Map<Integer,String> formats=new HashMap<>();List<Integer> styles=new ArrayList<>();
  if(zip.getEntry("xl/styles.xml")!=null){Document style=xml("xl/styles.xml");for(Element fmt:elements(style,"numFmt"))formats.put(integer(fmt.getAttribute("numFmtId"),0),fmt.getAttribute("formatCode"));List<Element> xfs=elements(style,"cellXfs");if(!xfs.isEmpty())for(Element xf:elements(xfs.get(0),"xf"))styles.add(integer(xf.getAttribute("numFmtId"),0));}
  List<Sheet> sheets=new ArrayList<>();
  for(Element sheet:elements(book,"sheet")){
   if(sheets.size()>=32)throw new IOException("工作表超过 32 张，请拆分后导入");
   String id=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id"),path=paths.get(id);if(path==null)throw new IOException("工作表关联损坏");
   Sheet result=new Sheet(sheet.getAttribute("name"));Document doc=xml(path);
   for(Element row:elements(doc,"row")){
    int rn=integer(row.getAttribute("r"),result.rows.size()+1);if(rn<1||rn>50000)throw new IOException("工作表超过 50000 行");
    while(result.rows.size()<rn)result.rows.add(new ArrayList<>());List<String> values=result.rows.get(rn-1);
    for(Element c:elements(row,"c")){
     if(++cells>250000)throw new IOException("表格单元格过多");String ref=c.getAttribute("r");int col=0;for(int i=0;i<ref.length()&&Character.isLetter(ref.charAt(i));i++)col=col*26+Character.toUpperCase(ref.charAt(i))-'A'+1;
     if(col==0)col=values.size()+1;if(col>256)throw new IOException("工作表超过 256 列");
     String v=value(c,"v"),type=c.getAttribute("t");
     if(!elements(c,"f").isEmpty())v="";
     else if("s".equals(type)){int index=integer(v,-1);if(index<0||index>=shared.size())throw new IOException("表格文本索引损坏");v=shared.get(index);}
     else if("inlineStr".equals(type))v=text(c);
     else if("e".equals(type)||"b".equals(type)||"d".equals(type))v="";
     else if((type.isEmpty()||"n".equals(type))&&!v.isEmpty()){
      int styleIndex=integer(c.getAttribute("s"),0),formatId=styleIndex<styles.size()?styles.get(styleIndex):0;String format=formats.getOrDefault(formatId,"");
      String bare=format.replaceAll("\"[^\"]*\"|\\\\.","");
      if((formatId>=14&&formatId<=22)||(formatId>=45&&formatId<=47)||formatId==9||formatId==10||bare.matches(".*[ymdhsYMDHS%].*"))v="";
      else {BigDecimal number=new BigDecimal(v);v=number.stripTrailingZeros().toPlainString();if(format.matches("0{2,20}")&&number.stripTrailingZeros().scale()<=0&&!v.startsWith("-"))while(v.length()<format.length())v="0"+v;}
     }
     if(v.length()>2000)throw new IOException("单元格文字过长");while(values.size()<col)values.add("");values.set(col-1,v);
    }
   }
   sheets.add(result);
  }
  return sheets;
 }
}
