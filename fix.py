import re  
f=open('src/contexts/CanvasContext.tsx','r',encoding='utf-8')  
c=f.read()  
f.close()  
c=re.sub(r'useCallback,\s*','',c)  
f=open('src/contexts/CanvasContext.tsx','w',encoding='utf-8')  
f.write(c)  
f.close()  
