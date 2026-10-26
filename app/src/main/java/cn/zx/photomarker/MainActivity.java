package cn.zx.photomarker;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.webkit.*;
import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;
import org.json.*;

public class MainActivity extends Activity {
 private volatile String language="en"; private JSONObject translations=new JSONObject();
 private String imageRequest="",cameraRequest="",priceRequest=""; private File cameraFile; private WebView web; private File data, staging; private boolean recoveryExport=false; private final ExecutorService io=Executors.newSingleThreadExecutor();
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);getWindow().getAttributes().layoutInDisplayCutoutMode=android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;enterFullscreen();
  data=new File(getFilesDir(),"data"); File previous=new File(getFilesDir(),"previous");if(!data.exists()&&previous.exists())previous.renameTo(data);data.mkdirs();new File(data,"images").mkdirs();
  try{translations=new JSONObject(new String(readBytes(getAssets().open("locales.json")),StandardCharsets.UTF_8));String pref=new JSONObject(readState().isEmpty()?"{}":readState()).optJSONObject("settings")==null?"auto":new JSONObject(readState()).getJSONObject("settings").optString("language","auto");language=resolveLanguage(pref);}catch(Exception ignored){language=resolveLanguage("auto");}
  web=new WebView(this);web.setBackgroundColor(Color.rgb(23,42,50));web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(false);web.addJavascriptInterface(new Bridge(),"Native");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){try{Uri u=r.getUrl();if(!"https".equals(u.getScheme())||!"local.app".equals(u.getHost()))return empty();String path=u.getPath();if(path.startsWith("/images/")){String name=path.substring(8);if(!name.matches("img_[a-zA-Z0-9-]+\\.jpg"))return empty();return new WebResourceResponse("image/jpeg",null,new FileInputStream(new File(data,"images/"+name)));}String asset=path.equals("/")?"index.html":path.substring(1);if(!Arrays.asList("index.html","app.js","model.js","extras.js","style.css","locales.js","i18n.js").contains(asset))return empty();return new WebResourceResponse(asset.endsWith(".js")?"application/javascript":asset.endsWith(".css")?"text/css":"text/html","UTF-8",getAssets().open(asset));}catch(Exception e){return empty();}}
  });setContentView(web);web.loadUrl("https://local.app/");
 }
 private static void copy(InputStream in,OutputStream out)throws IOException{byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);}
 private static byte[] readBytes(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();copy(in,out);return out.toByteArray();}
 private void enterFullscreen(){getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE|android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|android.view.View.SYSTEM_UI_FLAG_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)enterFullscreen();}
 private WebResourceResponse empty(){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
 private void js(String name,String arg){runOnUiThread(()->web.evaluateJavascript("window."+name+"("+arg+")",null));}
 private void message(String text){js("onNativeMessage",JSONObject.quote(text));}
 private void error(Exception e){js("onNativeError",JSONObject.quote(e.getMessage()==null?L("操作失败"):e.getMessage()));}
 private synchronized String readState() throws IOException {File f=new File(data,"state.json");AtomicFile af=new AtomicFile(f);if(!f.exists()&&!new File(data,"state.json.bak").exists())return "";try(InputStream in=af.openRead()){return new String(readBytes(in),StandardCharsets.UTF_8);}}
 private synchronized void writeState(String text)throws IOException{AtomicFile af=new AtomicFile(new File(data,"state.json"));FileOutputStream out=null;try{out=af.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));af.finishWrite(out);}catch(IOException e){if(out!=null)af.failWrite(out);throw e;}}
 private String resolveLanguage(String value){String v=value.equals("auto")?Locale.getDefault().toLanguageTag():value;if(v.toLowerCase(Locale.ROOT).startsWith("zh"))return v.matches("(?i).*(TW|HK|MO|Hant).*")?"zh-TW":"zh-CN";String base=v.split("-")[0];return Arrays.asList("en","bg","ja","ko","ru","de","fr","es").contains(base)?base:"en";}
 private String L(String key){if(language.equals("zh-CN"))return key;JSONObject dict=translations.optJSONObject(language);return dict==null?key:dict.optString(key,key);}
 public class Bridge {
  @JavascriptInterface public String systemLanguage(){return Locale.getDefault().toLanguageTag();}
  @JavascriptInterface public void setLanguage(String value){language=resolveLanguage(value);}

  @JavascriptInterface public String load(){try{return readState();}catch(Exception e){error(e);return "";}}
  @JavascriptInterface public String save(String text){try{new JSONObject(text);writeState(text);return "";}catch(Exception e){return e.getMessage();}}
  @JavascriptInterface public void importPhoto(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,1);});}
  @JavascriptInterface public void importProductImages(String request){runOnUiThread(()->{imageRequest=request;try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);startActivityForResult(i,4);}catch(Exception e){productImagesResult(request,new JSONArray(),L("无法打开图片选择器"));}});}
  @JavascriptInterface public void captureProductImage(String request){runOnUiThread(()->{cameraRequest=request;try{
   File dir=new File(getCacheDir(),"camera");if(!dir.exists()&&!dir.mkdirs())throw new IOException(L("无法创建拍照文件"));cameraFile=new File(dir,"capture_"+UUID.randomUUID()+".jpg");
   Uri uri=Uri.parse("content://"+getPackageName()+".camera/"+cameraFile.getName());Intent intent=new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT,uri);intent.setClipData(ClipData.newRawUri(L("商品拍照"),uri));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);startActivityForResult(intent,5);
  }catch(ActivityNotFoundException e){finishCamera(request,null,Activity.RESULT_CANCELED,L("未找到可用的相机应用"));}catch(Exception e){finishCamera(request,null,Activity.RESULT_CANCELED,L("无法打开相机，请重试"));}});}
  @JavascriptInterface public void importPrices(String request){runOnUiThread(()->{priceRequest=request;try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/octet-stream"});startActivityForResult(i,6);}catch(Exception e){pricesResult(request,new JSONArray(),L("无法打开表格选择器"),false);}});}
  @JavascriptInterface public void exportBackup(boolean recovery){runOnUiThread(()->{recoveryExport=recovery;if(recovery&&!new File(getFilesDir(),"before-restore.zip").exists()){message(L("还没有恢复前的自动备份"));return;}Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/zip");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,(recovery?L("恢复前备份-"):L("商品照片备份-"))+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",Locale.ROOT).format(new Date())+".zip");startActivityForResult(i,2);});}
  @JavascriptInterface public void restoreBackup(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,3);});}
  @JavascriptInterface public void backupValidated(boolean valid){io.execute(()->{if(staging==null)return;try{if(!valid){deleteTree(staging);staging=null;return;}synchronized(MainActivity.this){File recovery=new File(getFilesDir(),"before-restore.zip"),tmp=new File(getFilesDir(),"before-restore.tmp");try(OutputStream out=new FileOutputStream(tmp)){backup(out);}Files.move(tmp.toPath(),recovery.toPath(),StandardCopyOption.REPLACE_EXISTING);File previous=new File(getFilesDir(),"previous");deleteTree(previous);if(!data.renameTo(previous))throw new IOException(L("无法准备替换，原资料保持不变"));if(!staging.renameTo(data)){previous.renameTo(data);throw new IOException(L("恢复失败，已保留原资料"));}staging=null;deleteTree(previous);}js("onRestored","");}catch(Exception e){error(e);}});}
 }
 @Override protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);if(request==6){final String token=priceRequest;if(result!=RESULT_OK||intent==null||intent.getData()==null){pricesResult(token,new JSONArray(),"",true);return;}final Uri uri=intent.getData();io.execute(()->{try{pricesResult(token,readPriceWorkbook(uri),"",false);}catch(Exception e){pricesResult(token,new JSONArray(),e.getMessage()==null?L("表格读取失败"):e.getMessage(),false);}});return;}if(request==5){finishCamera(cameraRequest,cameraFile,result,"");return;}if(request==4){final String token=imageRequest;LinkedHashSet<Uri> uris=new LinkedHashSet<>();if(result==RESULT_OK&&intent!=null){if(intent.getClipData()!=null){for(int n=0;n<intent.getClipData().getItemCount();n++)uris.add(intent.getClipData().getItemAt(n).getUri());}else if(intent.getData()!=null)uris.add(intent.getData());}io.execute(()->{JSONArray files=new JSONArray();int failures=0;for(Uri u:uris){try{files.put(storeImage(u));}catch(Exception e){failures++;}}productImagesResult(token,files,failures==0?"":failures+L(" 张图片无法读取，其他图片已添加"));});return;}if(result!=RESULT_OK||intent==null||intent.getData()==null)return;Uri uri=intent.getData();io.execute(()->{try{if(request==1)importImage(uri);if(request==2){try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException(L("无法写入备份"));if(recoveryExport){try(InputStream in=new FileInputStream(new File(getFilesDir(),"before-restore.zip"))){copy(in,out);}}else backup(out);}message(L("完整备份已导出"));}if(request==3)prepareRestore(uri);}catch(Exception e){error(e);}});}
 private JSONArray readPriceWorkbook(Uri uri)throws Exception{
  File temp=File.createTempFile("price-import-",".xlsx",getCacheDir());try{
   try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(temp)){if(in==null)throw new IOException(L("无法读取表格"));byte[] b=new byte[8192];int n;long size=0;while((n=in.read(b))!=-1){size+=n;if(size>20*1024*1024)throw new IOException(L("表格超过 20 MB，请拆分后导入"));out.write(b,0,n);}}
   JSONArray sheets=new JSONArray();for(PriceWorkbook.Sheet sheet:PriceWorkbook.read(temp)){JSONObject obj=new JSONObject();obj.put("name",sheet.name);JSONArray rows=new JSONArray();for(List<String> row:sheet.rows)rows.put(new JSONArray(row));obj.put("rows",rows);sheets.put(obj);}return sheets;
  }finally{temp.delete();}
 }
 private void pricesResult(String request,JSONArray sheets,String error,boolean cancelled){try{JSONObject result=new JSONObject();result.put("request",request);result.put("sheets",sheets);result.put("error",error);result.put("cancelled",cancelled);js("onPricesLoaded",result.toString());}catch(JSONException e){error(e);}}
 private void finishCamera(String request,File captured,int result,String initialError){
  final File file=captured!=null?captured:cameraFile;cameraFile=null;
  io.execute(()->{JSONArray files=new JSONArray();String failure=initialError;try{if(result==RESULT_OK){if(file==null||!file.isFile()||file.length()==0)throw new IOException(L("相机未返回照片，请重新拍摄"));files.put(storeImage(Uri.fromFile(file)));}}catch(Exception e){failure=L("拍摄图片无法读取，请重新拍摄");}finally{if(file!=null){revokeUriPermission(Uri.parse("content://"+getPackageName()+".camera/"+file.getName()),Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);file.delete();}}productImagesResult(request,files,failure);});
 }
 // Only the explicitly granted temporary capture URI is exposed to the camera.
 public static class CameraProvider extends ContentProvider {
  @Override public boolean onCreate(){return true;}
  private File captureFile(Uri uri)throws FileNotFoundException{String name=uri.getLastPathSegment();if(uri.getPathSegments().size()!=1||name==null||!name.matches("capture_[a-fA-F0-9-]+\\.jpg"))throw new FileNotFoundException("Invalid capture URI");return new File(new File(getContext().getCacheDir(),"camera"),name);}
  @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{File file=captureFile(uri);int flags=ParcelFileDescriptor.parseMode(mode);return ParcelFileDescriptor.open(file,flags);}
  @Override public String getType(Uri uri){return "image/jpeg";}
  @Override public android.database.Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){try{File file=captureFile(uri);String[] columns=projection==null?new String[]{android.provider.OpenableColumns.DISPLAY_NAME,android.provider.OpenableColumns.SIZE}:projection;android.database.MatrixCursor cursor=new android.database.MatrixCursor(columns);Object[] values=new Object[columns.length];for(int i=0;i<columns.length;i++){if(columns[i].equals(android.provider.OpenableColumns.DISPLAY_NAME))values[i]=file.getName();else if(columns[i].equals(android.provider.OpenableColumns.SIZE))values[i]=file.length();}cursor.addRow(values);return cursor;}catch(FileNotFoundException e){return null;}}
  @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
  @Override public int update(Uri uri,ContentValues values,String selection,String[] args){throw new UnsupportedOperationException();}
  @Override public int delete(Uri uri,String selection,String[] args){throw new UnsupportedOperationException();}
 }
 private void productImagesResult(String request,JSONArray files,String error){try{JSONObject result=new JSONObject();result.put("request",request);result.put("files",files);result.put("error",error);js("onProductImagesImported",result.toString());}catch(JSONException e){error(e);}}
 private String storeImage(Uri uri)throws Exception{
  ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);Bitmap image=ImageDecoder.decodeBitmap(source,(decoder,info,s)->{decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);int w=info.getSize().getWidth(),h=info.getSize().getHeight();int longest=Math.max(w,h);if(longest>6000)decoder.setTargetSize(Math.max(1,w*6000/longest),Math.max(1,h*6000/longest));});
  String name="img_"+UUID.randomUUID()+".jpg";File f=new File(data,"images/"+name);try(OutputStream out=new FileOutputStream(f)){if(!image.compress(Bitmap.CompressFormat.JPEG,95,out))throw new IOException(L("照片转换失败"));}catch(Exception e){f.delete();throw e;}finally{image.recycle();}return name;
 }
 private void importImage(Uri uri)throws Exception{String name=storeImage(uri);JSONObject p=new JSONObject();p.put("id",UUID.randomUUID().toString());p.put("file",name);p.put("name",L("货架照片 ")+new java.text.SimpleDateFormat("MM-dd HH:mm",Locale.ROOT).format(new Date()));js("onPhotoImported",p.toString());}
 // One inventory is used by export and restore, including product attachments.
 private Set<String> imageFiles(JSONObject state)throws Exception{
  Set<String> files=new LinkedHashSet<>();JSONArray photos=state.getJSONArray("photos");for(int i=0;i<photos.length();i++)files.add(photos.getJSONObject(i).getString("file"));
  JSONObject products=state.getJSONObject("products");Iterator<String> keys=products.keys();while(keys.hasNext()){JSONObject product=products.getJSONObject(keys.next());if(product.has("images")){JSONArray images=product.getJSONArray("images");for(int i=0;i<images.length();i++)files.add(images.getString(i));}}
  for(String file:files)if(!file.matches("img_[a-zA-Z0-9-]+\\.jpg"))throw new IOException(L("图片路径无效"));return files;
 }
 private synchronized void backup(OutputStream raw)throws Exception{String text=readState();if(text.isEmpty())throw new IOException(L("请先导入照片或保存资料"));JSONObject state=new JSONObject(text);try(ZipOutputStream zip=new ZipOutputStream(raw)){zip.putNextEntry(new ZipEntry("state.json"));zip.write(text.getBytes(StandardCharsets.UTF_8));zip.closeEntry();for(String file:imageFiles(state)){File f=new File(data,"images/"+file);if(!f.isFile())throw new IOException(L("货架照片或商品附图缺失，备份未完成"));zip.putNextEntry(new ZipEntry("images/"+file));try(InputStream in=new FileInputStream(f)){copy(in,zip);}zip.closeEntry();}}}
 private void prepareRestore(Uri uri)throws Exception{File dir=new File(getFilesDir(),"restore-"+UUID.randomUUID());dir.mkdirs();try{long total=0;int entries=0;Set<String> names=new HashSet<>();try(InputStream raw=getContentResolver().openInputStream(uri);ZipInputStream zip=new ZipInputStream(raw)){ZipEntry entry;byte[] buf=new byte[65536];while((entry=zip.getNextEntry())!=null){String name=entry.getName();if(++entries>20000||!names.add(name)||!(name.equals("state.json")||name.matches("images/img_[a-zA-Z0-9-]+\\.jpg")))throw new IOException(L("不支持的备份内容"));File f=new File(dir,name);f.getParentFile().mkdirs();long size=0;try(OutputStream out=new FileOutputStream(f)){int n;while((n=zip.read(buf))!=-1){size+=n;total+=n;if(total>2L*1024*1024*1024||(name.equals("state.json")&&size>20*1024*1024))throw new IOException(L("备份超过可恢复大小"));out.write(buf,0,n);}}}}
  String text=new String(Files.readAllBytes(new File(dir,"state.json").toPath()),StandardCharsets.UTF_8);JSONObject state=new JSONObject(text);for(String file:imageFiles(state)){File f=new File(dir,"images/"+file);BitmapFactory.Options opts=new BitmapFactory.Options();opts.inJustDecodeBounds=true;BitmapFactory.decodeFile(f.getPath(),opts);if(opts.outWidth<1||opts.outHeight<1)throw new IOException(L("备份中的货架照片或商品附图缺失或损坏"));}new File(dir,"images").mkdirs();staging=dir;js("checkBackup",JSONObject.quote(text));
 }catch(Exception e){deleteTree(dir);throw e;}}
 private void deleteTree(File f)throws IOException{if(!f.exists())return;if(f.isDirectory()){File[] children=f.listFiles();if(children!=null)for(File child:children)deleteTree(child);}if(!f.delete())throw new IOException(L("无法清理临时资料"));}
 @Override public void onBackPressed(){web.evaluateJavascript("window.goBack ? window.goBack() : false",value->{if(!"true".equals(value))new AlertDialog.Builder(this).setMessage(L("退出照片商品定位？资料已自动保存。")).setNegativeButton(L("继续使用"),null).setPositiveButton(L("退出"),(d,w)->finish()).show();});}
 @Override protected void onDestroy(){super.onDestroy();io.shutdown();}
}
