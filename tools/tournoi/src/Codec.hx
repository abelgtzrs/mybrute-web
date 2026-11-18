// Stand-in for Motion Twin's Codec (not in the archive): reads a flashvar holding a haxe-serialized value.
class Codec {
	public static function getData( name : String ) : Dynamic {
		var s : String = Reflect.field(flash.Lib._root, name);
		if( s == null ) throw "no data";
		return haxe.Unserializer.run(s);
	}
}
