package cn.zx.photomarker;
import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Bitmap;
import android.webkit.WebView;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;
import org.json.*;

public class AttachmentTest extends Instrumentation {
 MainActivity activity;File data;int checks=0;
 public void onCreate(Bundle args){super.onCreate(args);start();}
 void check(boolean ok,String text){if(!ok)throw new AssertionError(text);checks++;}
 Object call(String name,Class<?>[] types,Object... args)throws Exception{Method m=MainActivity.class.getDeclaredMethod(name,types);m.setAccessible(true);try{return m.invoke(activity,args);}catch(InvocationTargetException e){throw (Exception)e.getCause();}}
 String eval(String script)throws Exception{CountDownLatch done=new CountDownLatch(1);String[] result={null};Field f=MainActivity.class.getDeclaredField("web");f.setAccessible(true);WebView web=(WebView)f.get(activity);runOnMainSync(()->web.evaluateJavascript(script,v->{result[0]=v;done.countDown();}));if(!done.await(10,TimeUnit.SECONDS))throw new Exception("JS timeout");return result[0];}
 String read()throws Exception{return (String)call("readState",new Class<?>[]{});}
 void write(String text)throws Exception{call("writeState",new Class<?>[]{String.class},text);}
 byte[] jpeg()throws Exception{Bitmap b=Bitmap.createBitmap(12,12,Bitmap.Config.ARGB_8888);b.eraseColor(0xff22aa88);ByteArrayOutputStream out=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.JPEG,95,out);b.recycle();return out.toByteArray();}
 Set<String> entries(File zip)throws Exception{Set<String> names=new HashSet<>();try(ZipInputStream in=new ZipInputStream(new FileInputStream(zip))){ZipEntry e;while((e=in.getNextEntry())!=null)names.add(e.getName());}return names;}
 void export(File file)throws Exception{try(OutputStream out=new FileOutputStream(file)){call("backup",new Class<?>[]{OutputStream.class},out);}}
 void restore(File file)throws Exception{call("prepareRestore",new Class<?>[]{Uri.class},Uri.fromFile(file));}
 void waitFor(String script)throws Exception{for(int i=0;i<100;i++){if("true".equals(eval(script)))return;Thread.sleep(100);}throw new Exception("Condition timed out: "+script);}
 void tap(float x,float y){long now=SystemClock.uptimeMillis();android.view.MotionEvent down=android.view.MotionEvent.obtain(now,now,0,x,y,0),up=android.view.MotionEvent.obtain(now,now+60,1,x,y,0);down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);sendPointerSync(down);SystemClock.sleep(60);sendPointerSync(up);down.recycle();up.recycle();waitForIdleSync();}
 void hideKeyboard()throws Exception{eval("document.activeElement.blur()");runOnMainSync(()->((android.view.inputmethod.InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(activity.getWindow().getDecorView().getWindowToken(),0));Thread.sleep(400);}
 public void onStart(){Bundle result=new Bundle();try{
  activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  waitFor("typeof Model!=='undefined'");
  // Isolated test directory: never replace an existing application data directory.
  data=new File(activity.getFilesDir(),"attachment-test-"+System.nanoTime());new File(data,"images").mkdirs();Field field=MainActivity.class.getDeclaredField("data");field.setAccessible(true);field.set(activity,data);
  // Exercise full-resolution camera output with a null result Intent.
  eval("window.importResult=null;window.onProductImagesImported=r=>window.importResult=r");
  File cameraDir=new File(activity.getCacheDir(),"camera");cameraDir.mkdirs();File capture=new File(cameraDir,"capture_1234-abcd.jpg");Uri output=Uri.parse("content://cn.zx.photomarker.camera/"+capture.getName());
  try(OutputStream out=activity.getContentResolver().openOutputStream(output)){out.write(jpeg());}
  Field cf=MainActivity.class.getDeclaredField("cameraFile"),cr=MainActivity.class.getDeclaredField("cameraRequest");cf.setAccessible(true);cr.setAccessible(true);cf.set(activity,capture);cr.set(activity,"camera-success");runOnMainSync(()->activity.onActivityResult(5,Activity.RESULT_OK,null));waitFor("window.importResult!==null");
  check("1".equals(eval("window.importResult.files.length")),"camera null intent imports full output");check(!capture.exists(),"capture temporary file removed");
  eval("window.importResult=null");Files.write(capture.toPath(),jpeg());cf.set(activity,capture);runOnMainSync(()->activity.onActivityResult(5,Activity.RESULT_CANCELED,null));waitFor("window.importResult!==null");check("0".equals(eval("window.importResult.files.length"))&&!capture.exists(),"cancel camera does not add photo");
  eval("window.importResult=null");cf.set(activity,capture);runOnMainSync(()->activity.onActivityResult(5,Activity.RESULT_OK,null));waitFor("window.importResult!==null");check("0".equals(eval("window.importResult.files.length"))&&"true".equals(eval("!!window.importResult.error")),"missing camera output fails safely");
  File source1=new File(data,"source1.jpg"),source2=new File(data,"source2.jpg");Files.write(source1.toPath(),jpeg());Files.write(source2.toPath(),jpeg());
  eval("window.importResult=null;window.onProductImagesImported=r=>window.importResult=r");
  Field request=MainActivity.class.getDeclaredField("imageRequest");request.setAccessible(true);request.set(activity,"test-import");
  Intent picked=new Intent();ClipData clips=ClipData.newRawUri("one",Uri.fromFile(source1));clips.addItem(new ClipData.Item(Uri.fromFile(source2)));picked.setClipData(clips);
  runOnMainSync(()->activity.onActivityResult(4,Activity.RESULT_OK,picked));waitFor("window.importResult!==null");
  JSONObject imported=new JSONObject(new JSONArray("["+eval("JSON.stringify(window.importResult)")+"]").getString(0));JSONArray images=imported.getJSONArray("files");
  check(images.length()==2,"multi import");check(imported.getString("request").equals("test-import"),"request isolation");
  source1.delete();source2.delete();for(int i=0;i<images.length();i++)check(new File(data,"images/"+images.getString(i)).isFile(),"independent image copy");
  Files.write(new File(data,"images/img_shelf.jpg").toPath(),jpeg());Files.write(new File(data,"images/img_unused.jpg").toPath(),jpeg());
  JSONObject state=new JSONObject("{\"version\":1,\"photos\":[{\"id\":\"p\",\"name\":\"shelf\",\"file\":\"img_shelf.jpg\",\"marks\":[{\"id\":\"m\",\"product\":\"a\",\"x\":0.5,\"y\":0.5,\"w\":0.1,\"h\":0.1,\"angle\":0,\"shape\":\"dot\"}]}],\"products\":{\"a\":{\"model\":\"A\",\"price\":\"1\",\"attrs\":{}}},\"settings\":{\"font\":14,\"fields\":[\"model\"]}}");state.getJSONObject("products").getJSONObject("a").put("images",images);write(state.toString());
  File backup=new File(activity.getCacheDir(),"attachments.zip");export(backup);Set<String> names=entries(backup);check(names.size()==4&&names.contains("images/"+images.getString(0))&&names.contains("images/"+images.getString(1)),"backup contains shelf plus all attachments only");
  JSONObject changed=new JSONObject(state.toString());changed.getJSONObject("products").getJSONObject("a").put("price","99");write(changed.toString());restore(backup);
  waitFor("state.products.a && state.products.a.price==='1'");check(new JSONObject(read()).getJSONObject("products").getJSONObject("a").getJSONArray("images").length()==2,"restored image associations");
  Field current=MainActivity.class.getDeclaredField("data");current.setAccessible(true);File restoredData=(File)current.get(activity);for(int i=0;i<images.length();i++)check(new File(restoredData,"images/"+images.getString(i)).isFile(),"restored image bytes");
  File recovery=new File(activity.getFilesDir(),"before-restore.zip");check(entries(recovery).contains("images/"+images.getString(1)),"automatic before-restore backup includes images");
  // Missing attachment and damaged attachment must be rejected without replacing current state.
  for(boolean damaged:new boolean[]{false,true}){File bad=new File(activity.getCacheDir(),"bad-"+damaged+".zip");try(ZipOutputStream out=new ZipOutputStream(new FileOutputStream(bad))){out.putNextEntry(new ZipEntry("state.json"));out.write(state.toString().getBytes("UTF-8"));out.closeEntry();out.putNextEntry(new ZipEntry("images/img_shelf.jpg"));out.write(jpeg());out.closeEntry();for(int i=0;i<images.length();i++){if(i==0&&!damaged)continue;out.putNextEntry(new ZipEntry("images/"+images.getString(i)));out.write(i==0?new byte[]{1,2,3}:jpeg());out.closeEntry();}}
   String before=read();boolean failed=false;try{restore(bad);}catch(Exception e){failed=true;}check(failed&&read().equals(before),"bad backup rejected without data loss");}
  JSONObject old=new JSONObject(state.toString());old.getJSONObject("products").getJSONObject("a").remove("images");write(old.toString());File legacy=new File(activity.getCacheDir(),"legacy.zip");export(legacy);check(entries(legacy).size()==2,"legacy backup export");restore(legacy);waitFor("state.products.a && !state.products.a.images");check(!new JSONObject(read()).getJSONObject("products").getJSONObject("a").has("images"),"legacy restore");
  eval("window.importResult=null");runOnMainSync(()->activity.onActivityResult(4,Activity.RESULT_CANCELED,null));waitFor("window.importResult!==null");check("0".equals(eval("window.importResult.files.length")),"cancel picker completes request");
  // Real Android touch sequence: marker is underneath the dialog's Add Attribute button.
  waitFor("!!bitmap");
  eval("editing=true;adding=false;setToolsHidden(false);editMark(p().marks[0]);");
  hideKeyboard();
  JSONObject point=new JSONObject(new JSONArray("["+eval("JSON.stringify((()=>{const r=$('addAttr').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth};})())")+"]").getString(0));
  double x=point.getDouble("x"),y=point.getDouble("y");
  eval("$('dialog').close();setToolsHidden(true);p().marks[0].x=("+x+"-tx)/bitmap.width/scale;p().marks[0].y=("+y+"-ty)/bitmap.height/scale;selected=null;draw();window.releaseWasOpen=null;document.addEventListener('pointerup',()=>window.releaseWasOpen=$('dialog').open)");
  Field wf=MainActivity.class.getDeclaredField("web");wf.setAccessible(true);WebView wv=(WebView)wf.get(activity);int[] loc=new int[2],width={0};runOnMainSync(()->{wv.getLocationOnScreen(loc);width[0]=wv.getWidth();});float ratio=(float)(width[0]/point.getDouble("width"));
  for(int n=0;n<3;n++){
   tap(loc[0]+(float)x*ratio,loc[1]+(float)y*ratio);try{waitFor("$('dialog').open");}catch(Exception e){throw new Exception(e.getMessage()+" target="+eval("document.elementFromPoint("+x+","+y+").outerHTML")+" pointer="+eval("JSON.stringify({release:window.releaseWasOpen,pending:pendingTap,gesture:gesture})"));}
   check("false".equals(eval("window.releaseWasOpen")),"dialog must not open during touch release");
   check("0".equals(eval("$('attrs').children.length")),"opening touch must not activate form button");
   hideKeyboard();JSONObject button=new JSONObject(new JSONArray("["+eval("JSON.stringify((()=>{const r=$('addAttr').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})())")+"]").getString(0));
   tap(loc[0]+(float)button.getDouble("x")*ratio,loc[1]+(float)button.getDouble("y")*ratio);waitFor("$('attrs').children.length===1");check(true,"new dialog touch works");eval("$('dialog').close()");
  }
  result.putString("stream","OK: "+checks+" Android attachment import/backup/restore checks\n");finish(Activity.RESULT_OK,result);
 }catch(Throwable e){result.putString("stream","FAIL: "+e.toString()+"\n"+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}}
}
