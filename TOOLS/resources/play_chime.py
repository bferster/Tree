import sys
import winsound

def play_sound():
    try:
        # Play SystemAsterisk chime on Windows
        winsound.PlaySound("SystemAsterisk", winsound.SND_ALIAS)
    except Exception as e:
        print(f"Failed to play sound: {e}", file=sys.stderr)

if __name__ == "__main__":
    play_sound()
