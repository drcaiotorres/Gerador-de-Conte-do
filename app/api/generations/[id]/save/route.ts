import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { edited_payload } = await req.json();
    if (!edited_payload) return NextResponse.json({ ok:false, error:"edited_payload ausente" }, { status:400 });

    const supabase = supabaseServer();
    const { error } = await supabase
      .from("generations")
      .update({ edited_payload })
      .eq("id", params.id);

    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 });
  }
}
