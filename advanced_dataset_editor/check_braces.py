
def analyze_braces(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char == '{':
                stack.append((i + 1, j + 1))
            elif char == '}':
                if not stack:
                    print(f"Error: Unexpected '}}' at line {i + 1}, col {j + 1}")
                    return
                stack.pop()
    
    if stack:
        print(f"Error: Unclosed '{{' at line {stack[-1][0]}, col {stack[-1][1]}")
        print(f"Total unclosed braces: {len(stack)}")
        # Print the last few unclosed braces to give context
        for pos in stack[-5:]:
             print(f"Unclosed '{{' at line {pos[0]}, col {pos[1]}")

analyze_braces(r"c:\desktop_dataset_editor\desktop_dataset_editor\advanced_dataset_editor\src\App.js")
