import json

transcript_path = r"C:\Users\jorge\.gemini\antigravity\brain\427c418f-1f44-43c5-8cb7-8ecda96f1a71\.system_generated\logs\transcript.jsonl"
output_path = r"c:\Users\jorge\VK Joyas\Android TV - Digital Signage\PlaylistEditor.cs"

candidates = []

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        if "PlaylistEditor.cs" in line and "write_to_file" in line:
            try:
                data = json.loads(line)
                for tool in data.get("tool_calls", []):
                    if tool.get("name") == "write_to_file" and "PlaylistEditor.cs" in tool.get("args", {}).get("TargetFile", ""):
                        code = tool["args"]["CodeContent"]
                        step = data.get("step_index", 0)
                        candidates.append((step, len(code), code))
            except Exception as e:
                pass

# Sort by length of code descending
candidates.sort(key=lambda x: x[1], reverse=True)

if candidates:
    best_step, best_len, best_code = candidates[0]
    print(f"Found candidate from step {best_step} with length {best_len}")
    
    # Decode string escapes if needed
    if best_code.startswith('"') and best_code.endswith('"'):
        try:
            best_code = json.loads(best_code)
        except Exception:
            pass
    if "\\n" in best_code:
        best_code = best_code.replace("\\n", "\n").replace('\\"', '"').replace('\\\\', '\\')
    
    # Ensure no leading/trailing quote characters remain from manual string manipulation
    if best_code.startswith('"'):
        best_code = best_code[1:]
    if best_code.endswith('"'):
        best_code = best_code[:-1]
        
    with open(output_path, 'w', encoding='utf-8') as out_f:
        out_f.write(best_code)
    print("SUCCESS")
else:
    print("NOT FOUND")
