length:
	find . -type d -name node_modules -prune -false -o -name '*.js' -o -name '*.css' -o -name '*.html' > _contentful_files
	cat `cat _contentful_files` | wc -l
	rm _contentful_files 

