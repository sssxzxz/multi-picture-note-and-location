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
 private WebView web; private File data, staging; private boolean recoveryExport=false; private final ExecutorService io=Executors.newSingleThreadExecutor();
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);getWindow().getAttributes().layoutInDisplayCutoutMode=android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;enterFullscreen();
  data=new File(getFilesDir(),"data"); File previous=new File(getFilesDir(),"previous");if(!data.exists()&&previous.exists())previous.renameTo(data);data.mkdirs();new File(data,"images").mkdirs();
  web=new WebView(this);web.setBackgroundColor(Color.rgb(23,42,50));web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(false);web.addJavascriptInterface(new Bridge(),"Native");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){try{Uri u=r.getUrl();if(!"https".equals(u.getScheme())||!"local.app".equals(u.getHost()))return empty();String path=u.getPath();if(path.startsWith("/images/")){String name=path.substring(8);if(!name.matches("img_[a-zA-Z0-9-]+\\.jpg"))return empty();return new WebResourceResponse("image/jpeg",null,new FileInputStream(new File(data,"images/"+name)));}String asset=path.equals("/")?"index.html":path.substring(1);if(!Arrays.asList("index.html","app.js","model.js","style.css").contains(asset))return empty();return new WebResourceResponse(asset.endsWith(".js")?"application/javascript":asset.endsWith(".css")?"text/css":"text/html","UTF-8",getAssets().open(asset));}catch(Exception e){return empty();}}
  });setContentView(web);web.loadUrl("https://local.app/");
 }
 private static void copy(InputStream in,OutputStream out)throws IOException{byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);}
 private static byte[] readBytes(InputStream in)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();copy(in,out);return out.toByteArray();}
 private void enterFullscreen(){getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE|android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|android.view.View.SYSTEM_UI_FLAG_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)enterFullscreen();}
 private WebResourceResponse empty(){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
 private void js(String name,String arg){runOnUiThread(()->web.evaluateJavascript("window."+name+"("+arg+")",null));}
 private void message(String text){js("onNativeMessage",JSONObject.quote(text));}
 private void error(Exception e){js("onNativeError",JSONObject.quote(e.getMessage()==null?"操作失败":e.getMessage()));}
 private synchronized String readState() throws IOException {File f=new File(data,"state.json");AtomicFile af=new AtomicFile(f);if(!f.exists()&&!new File(data,"state.json.bak").exists())return "";try(InputStream in=af.openRead()){return new String(readBytes(in),StandardCharsets.UTF_8);}}
 private synchronized void writeState(String text)throws IOException{AtomicFile af=new AtomicFile(new File(data,"state.json"));FileOutputStream out=null;try{out=af.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));af.finishWrite(out);}catch(IOException e){if(out!=null)af.failWrite(out);throw e;}}
 public class Bridge {
  @JavascriptInterface public String load(){try{return readState();}catch(Exception e){error(e);return "";}}
  @JavascriptInterface public String save(String text){try{new JSONObject(text);writeState(text);return "";}catch(Exception e){return e.getMessage();}}
  @JavascriptInterface public void importPhoto(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,1);});}
  @JavascriptInterface public void exportBackup(boolean recovery){runOnUiThread(()->{recoveryExport=recovery;if(recovery&&!new File(getFilesDir(),"before-restore.zip").exists()){message("还没有恢复前的自动备份");return;}Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/zip");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,(recovery?"恢复前备份-":"商品照片备份-")+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",Locale.ROOT).format(new Date())+".zip");startActivityForResult(i,2);});}
  @JavascriptInterface public void restoreBackup(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,3);});}
  @JavascriptInterface public void backupValidated(boolean valid){io.execute(()->{if(staging==null)return;try{if(!valid){deleteTree(staging);staging=null;return;}synchronized(MainActivity.this){File recovery=new File(getFilesDir(),"before-restore.zip"),tmp=new File(getFilesDir(),"before-restore.tmp");try(OutputStream out=new FileOutputStream(tmp)){backup(out);}Files.move(tmp.toPath(),recovery.toPath(),StandardCopyOption.REPLACE_EXISTING);File previous=new File(getFilesDir(),"previous");deleteTree(previous);if(!data.renameTo(previous))throw new IOException("无法准备替换，原资料保持不变");if(!staging.renameTo(data)){previous.renameTo(data);throw new IOException("恢复失败，已保留原资料");}staging=null;deleteTree(previous);}js("onRestored","");}catch(Exception e){error(e);}});}
 }
 @Override protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);if(result!=RESULT_OK||intent==null||intent.getData()==null)return;Uri uri=intent.getData();io.execute(()->{try{if(request==1)importImage(uri);if(request==2){try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("无法写入备份");if(recoveryExport){try(InputStream in=new FileInputStream(new File(getFilesDir(),"before-restore.zip"))){copy(in,out);}}else backup(out);}message("完整备份已导出");}if(request==3)prepareRestore(uri);}catch(Exception e){error(e);}});}
 private void importImage(Uri uri)throws Exception{
  ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);Bitmap image=ImageDecoder.decodeBitmap(source,(decoder,info,s)->{decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);int w=info.getSize().getWidth(),h=info.getSize().getHeight();int longest=Math.max(w,h);if(longest>6000)decoder.setTargetSize(Math.max(1,w*6000/longest),Math.max(1,h*6000/longest));});
  String id=UUID.randomUUID().toString(),name="img_"+id+".jpg";File f=new File(data,"images/"+name);try(OutputStream out=new FileOutputStream(f)){if(!image.compress(Bitmap.CompressFormat.JPEG,95,out))throw new IOException("照片转换失败");}finally{image.recycle();}JSONObject p=new JSONObject();p.put("id",id);p.put("file",name);p.put("name","货架照片 "+new java.text.SimpleDateFormat("MM-dd HH:mm",Locale.ROOT).format(new Date()));js("onPhotoImported",p.toString());
 }
 private synchronized void backup(OutputStream raw)throws Exception{String text=readState();if(text.isEmpty())throw new IOException("请先导入照片或保存资料");JSONObject state=new JSONObject(text);try(ZipOutputStream zip=new ZipOutputStream(raw)){zip.putNextEntry(new ZipEntry("state.json"));zip.write(text.getBytes(StandardCharsets.UTF_8));zip.closeEntry();JSONArray photos=state.getJSONArray("photos");Set<String> seen=new HashSet<>();for(int i=0;i<photos.length();i++){String file=photos.getJSONObject(i).getString("file");if(!file.matches("img_[a-zA-Z0-9-]+\\.jpg")||!seen.add(file))continue;File f=new File(data,"images/"+file);if(!f.isFile())throw new IOException("照片缺失，备份未完成");zip.putNextEntry(new ZipEntry("images/"+file));try(InputStream in=new FileInputStream(f)){copy(in,zip);}zip.closeEntry();}}}
 private void prepareRestore(Uri uri)throws Exception{File dir=new File(getFilesDir(),"restore-"+UUID.randomUUID());dir.mkdirs();try{long total=0;int entries=0;Set<String> names=new HashSet<>();try(InputStream raw=getContentResolver().openInputStream(uri);ZipInputStream zip=new ZipInputStream(raw)){ZipEntry entry;byte[] buf=new byte[65536];while((entry=zip.getNextEntry())!=null){String name=entry.getName();if(++entries>20000||!names.add(name)||!(name.equals("state.json")||name.matches("images/img_[a-zA-Z0-9-]+\\.jpg")))throw new IOException("不支持的备份内容");File f=new File(dir,name);f.getParentFile().mkdirs();long size=0;try(OutputStream out=new FileOutputStream(f)){int n;while((n=zip.read(buf))!=-1){size+=n;total+=n;if(total>2L*1024*1024*1024||(name.equals("state.json")&&size>20*1024*1024))throw new IOException("备份超过可恢复大小");out.write(buf,0,n);}}}}
  String text=new String(Files.readAllBytes(new File(dir,"state.json").toPath()),StandardCharsets.UTF_8);JSONObject state=new JSONObject(text);JSONArray photos=state.getJSONArray("photos");for(int i=0;i<photos.length();i++){String file=photos.getJSONObject(i).getString("file");if(!file.matches("img_[a-zA-Z0-9-]+\\.jpg"))throw new IOException("照片路径无效");File f=new File(dir,"images/"+file);BitmapFactory.Options opts=new BitmapFactory.Options();opts.inJustDecodeBounds=true;BitmapFactory.decodeFile(f.getPath(),opts);if(opts.outWidth<1||opts.outHeight<1)throw new IOException("备份中的照片缺失或损坏");}new File(dir,"images").mkdirs();staging=dir;js("checkBackup",JSONObject.quote(text));
 }catch(Exception e){deleteTree(dir);throw e;}}
 private void deleteTree(File f)throws IOException{if(!f.exists())return;if(f.isDirectory()){File[] children=f.listFiles();if(children!=null)for(File child:children)deleteTree(child);}if(!f.delete())throw new IOException("无法清理临时资料");}
 @Override public void onBackPressed(){web.evaluateJavascript("document.getElementById('dialog').open",value->{if("true".equals(value))web.evaluateJavascript("document.getElementById('dialog').close()",null);else new AlertDialog.Builder(this).setMessage("退出照片商品定位？资料已自动保存。").setNegativeButton("继续使用",null).setPositiveButton("退出",(d,w)->finish()).show();});}
 @Override protected void onDestroy(){super.onDestroy();io.shutdown();}
}
