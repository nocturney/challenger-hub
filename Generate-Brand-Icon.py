from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math, random, os

OUT = r"D:\Velvet\Installers\CraftSuite\Center"
N=1536
S=N/1024
def sc(p): return tuple(int(round(x*S)) for x in p)
def P(points):return [sc(p) for p in points]
def ellipse_center(draw,xy,r,**kw):
    x,y=sc(xy);r=int(r*S)
    draw.ellipse((x-r,y-r,x+r,y+r),**kw)
def polystroke(mask,pts,width,fill):
    d=ImageDraw.Draw(mask)
    points=P(pts);w=int(width*S)
    d.line(points,fill=fill,width=w,joint='curve')
    for x,y in points:
        rad=w//2;d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=fill)

canvas=Image.new("RGBA",(N,N),(0,0,0,0))
# The app-tile is deliberately dark so the spectrum brand stays vibrant in both themes.
tile=Image.new("RGBA",(N,N),(0,0,0,0))
td=ImageDraw.Draw(tile)
# A layered, gently-lit graphite/indigo rounded rectangle.
td.rounded_rectangle(sc((41,42,982,983)),radius=int(215*S),fill=(12,21,37,255))
for center,r,c,alpha in [
    ((208,200),355,(35,79,135),74),
    ((876,165),330,(62,43,105),64),
    ((780,870),360,(95,45,110),60),
    ((210,775),350,(38,31,99),56),
]:
    light=Image.new("RGBA",(N,N));d=ImageDraw.Draw(light)
    ellipse_center(d,center,r,fill=(*c,alpha))
    tile=Image.alpha_composite(tile,light.filter(ImageFilter.GaussianBlur(int(175*S))))
# Clip ambiance to rounded silhouette.
shape=Image.new("L",(N,N),0)
ImageDraw.Draw(shape).rounded_rectangle(sc((41,42,982,983)),radius=int(215*S),fill=255)
tile.putalpha(shape)
canvas.alpha_composite(tile)
outline=Image.new("RGBA",(N,N))
od=ImageDraw.Draw(outline)
od.rounded_rectangle(sc((47,48,976,977)),radius=int(209*S),outline=(148,181,213,39),width=max(2,int(3*S)))
canvas.alpha_composite(outline)

# A faceted ribbon, whose perimeter describes C and whose color spectrum describes an evolving toolkit.
spine=[(800,295),(675,215),(446,215),(254,325),(254,691),(446,802),(673,802),(808,716)]
width=147
mask=Image.new("L",(N,N),0)
polystroke(mask,spine,width,255)
shadow=Image.new("RGBA",(N,N))
sl=Image.new("L",(N,N),0)
polystroke(sl,[(x+15,y+23) for x,y in spine],width+19,175)
sm=sl.filter(ImageFilter.GaussianBlur(int(28*S)))
shadow.paste((0,6,20,0),(0,0,N,N))
shadow.putalpha(sm)
canvas.alpha_composite(shadow)

# Additional outer glow, strongest on spectral corner nodes.
glows=[
    ((786,272),170,(255,177,83,110)),
    ((526,210),200,(46,186,255,100)),
    ((252,392),202,(33,155,255,96)),
    ((256,687),200,(111,67,255,98)),
    ((541,810),222,(228,65,246,105)),
    ((801,721),156,(255,87,131,100)),
]
halo=Image.new("RGBA",(N,N))
for xy,r,col in glows:
    layer=Image.new("RGBA",(N,N))
    ellipse_center(ImageDraw.Draw(layer),xy,r,fill=col)
    halo=Image.alpha_composite(halo,layer.filter(ImageFilter.GaussianBlur(int(93*S))))
# glow alpha reduced by dark glass surroundings, preserve clean icon
alpha=halo.getchannel("A").point(lambda x: int(x*0.24))
alpha=ImageChops.multiply(alpha,shape)
halo.putalpha(alpha)
canvas.alpha_composite(halo)

# Paint ribbon surface by feather-blending colored pools within the tube mask.
spectrum=Image.new("RGBA",(N,N),(75,96,195,255))
lights=[
    ((830,275),230,(255,156,67,255)),
    ((689,207),230,(255,210,79,255)),
    ((470,212),242,(44,203,255,255)),
    ((285,348),225,(39,116,255,255)),
    ((253,615),248,(121,70,251,255)),
    ((410,807),244,(159,49,250,255)),
    ((628,801),239,(240,63,186,255)),
    ((843,733),222,(255,117,97,255)),
]
for xy,rad,col in lights:
    layer=Image.new("RGBA",(N,N))
    ellipse_center(ImageDraw.Draw(layer),xy,rad,fill=col)
    blurred=layer.filter(ImageFilter.GaussianBlur(int(102*S)))
    # Gradient pools accumulate but do not produce hard boundaries.
    spectrum=Image.alpha_composite(spectrum,blurred)
# slight clear glaze on surface; mask to stroke.
ribbon=Image.new("RGBA",(N,N));ribbon.paste(spectrum,(0,0),mask)
canvas.alpha_composite(ribbon)

# Layered bevel catching light on top-left side.
high_mask=Image.new("L",(N,N),0)
polystroke(high_mask,[(x-13,y-17) for x,y in spine],width-35,180)
high_mask=ImageChops.multiply(high_mask,mask)
high_alpha=high_mask.point(lambda x:int(x*0.19))
highlight=Image.new("RGBA",(N,N),(255,255,255,0));highlight.putalpha(high_alpha)
canvas.alpha_composite(highlight)
# Thin cool-white edge to make facets visible at 64px.
edge=Image.new("RGBA",(N,N))
ed=ImageDraw.Draw(edge)
ed.line(P([(743,276),(656,218),(461,220),(303,312)]),
    fill=(235,248,255,147),width=max(3,int(4*S)),joint="curve")
ed.line(P([(300,331),(301,683)]),
    fill=(148,213,255,108),width=max(3,int(4*S)))
ed.line(P([(305,700),(457,784),(663,784)]),
    fill=(239,199,255,98),width=max(3,int(4*S)),joint='curve')
edge=edge.filter(ImageFilter.GaussianBlur(int(3*S)))
canvas.alpha_composite(edge)

# Slices and diamond seams at each end make the symbol feel like a physical modular ribbon.
facets=Image.new("RGBA",(N,N))
fd=ImageDraw.Draw(facets)
fd.line(P([(768,253),(830,315)]),fill=(255,233,174,115),width=max(2,int(5*S)))
fd.line(P([(763,755),(824,702)]),fill=(255,203,195,105),width=max(2,int(5*S)))
# Subtle center glint - update spark, rather than literal UI arrow glyph.
fd.polygon(P([(754,503),(766,529),(793,542),(766,554),(754,580),(741,554),(716,542),(741,529)]),fill=(255,204,132,230))
fd.polygon(P([(754,517),(763,537),(780,542),(763,548),(754,569),(745,548),(727,542),(745,537)]),fill=(255,242,203,218))
facets=facets.filter(ImageFilter.GaussianBlur(int(1.6*S)))
canvas.alpha_composite(facets)

dest=os.path.join(OUT,"brand-icon.png")
canvas.resize((1024,1024),Image.Resampling.LANCZOS).save(dest,optimize=True)
img=Image.open(dest).convert("RGBA")
native=r"D:\Velvet\Installers\CraftSuite\Center\NativeWindows\icon.ico"
img.save(native,format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("BRAND_ICON="+dest,"BYTES="+str(os.path.getsize(dest)))
print("WINDOWS_ICO="+native,"BYTES="+str(os.path.getsize(native)))
print("IMG_MODE="+img.mode, "CENTER_PIXEL="+str(img.getpixel((512,512))))
